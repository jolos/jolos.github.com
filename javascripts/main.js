$(function() {
    window.Router = Backbone.Router.extend({

      routes: {
        "*actions" : "default",
      },
    
      aliases : {
        '' : 'title/!elastic&!profiel&!plakboek&!test&!notes',
        'test' : 'type/gist',
        'all' : '/',
        'albums' : 'type/album/title/!plakboek&!profiel',
        'blogs' : 'type/blog',
      },

      initialize : function(){
        this.appview = new ItemListView();
        this.bind('route:default', function(route){
          window.document.title = " シ "+ route;
        });
        this.bind('route:default', function(route){
            _gaq.push(['_trackPageview', "/#"+ route])
        });
        Backbone.history.start();
        this.bind('route:default',this.appview.items.clean,this.appview.items);
        this.bind('route:default',draw);
      },

      default : function(actions){
        var alias = this.aliases[actions];

        if (alias) {
          var path = _.filter(alias.split("/"),function(str){ return str });
        } else {
          var path = _.filter(actions.split("/"),function(str){ return str });
        }
        // This function connects all the parts

        var filters = [];

        var typefilters = []

        while (path.length !=0) {
          var name = path.shift();
          var parser = new FilterParser(name);
          var query =path.shift();
          var filter = parser.parse(query);
          if (name == 'type'){
           typefilters.push(filter); 
          } 
          filters.push(filter); 
        }
        
        if( filters.length > 1 ) {
          this.appview.items.filter = new AndFilter(filters);
        } else if(filters.length == 1) {
          this.appview.items.filter = filters[0];
        } else {
          this.appview.items.filter = new TrueFilter();;
        }
 
        if( typefilters.length > 1 ) {
          this.appview.items.fetch(new AndFilter(typefilters));
        } else if(typefilters.length == 1) {
          this.appview.items.fetch(typefilters[0]);
        } else {
          this.appview.items.fetch(new TrueFilter());
        }

      },
    });

    window.FilterParser = function(name) {

      this.parse = function(query) {
        var filter = this.parseAnd(query);
        if(filter) {
          return filter;
        }

        filter = this.parseOr(query);

        if(filter) {
          return filter;
        }

        filter = this.parseNot(query);
        
        if(filter) {
          return filter;
        }

        filter = this.parseDefault(query); 
        return filter;
      };
        
      this.parseParentheses = function(query) {
        var pos1 = query.indexOf("(");
        var pos2 = query.indexOf(")");
        if ( pos1 == -1  && pos2 != -1){
          throw "invalid query";
        } else if (pos1 != -1) {
          return filter = this.parse(query.substring(pos1,pos2));
        } 

        return false;
      };

      this.parseAnd = function(query) {
        if(query.indexOf('&') != -1){
          var subqueries = query.split('&');
          return new AndFilter(_.map(subqueries,this.parse,this));
        }
        return false;
      };

      this.parseOr = function(query) {
        if(query.indexOf('|') != -1){
          var subqueries = query.split('|');
          return new OrFilter(_.map(subqueries,this.parse,this));
        }
        return false;
      };

      this.parseNot = function(query) {
        if(query.indexOf('!') != -1){
          var subquery = query.substring(1);
          return new NotFilter(this.parse(subquery));
        }
        return false;
      };

      this.parseDefault = function(query) {
        if (name == 'type'){
          return new TypeFilter(query);
        }
        return new PropertyRegexFilter(name,query);
      };
    };
    window.FilterFactory = function(defaultFilter) {
      this.default = defaultFilter;
    };

    _.extend(FilterFactory.prototype,{
      filters : [],

      getFilterInstance : function(name, arg){
        var tuple = _.find(this.filters, function(tuple){
          return name == tuple.name;
        });

        if (tuple) {
          var filter = new tuple.filter(arg);
        } else {
          // return default filter
          var filter = new defaultFilter(arg);
        }

        return filter;
      },

      register : function(name, filterobj) {
        var tuple ={'name': name, 'filter': filterobj};
        this.filter.push(tuple);
      },
    });

    window.OrFilter = function(filters) {
      if(filters.length < 2) {
          throw "OR filter needs at least two filters"
      }

      this.filter = function(item) {
        for (var i = 0; i < filters.length; i++){
          var filter = filters[i];
          if (filter.filter(item)) {
             return true;
          }
        }
        return false;
      };

      this.tostr = function() {
        return _.reduce(filters, function(memo,filter,idx){ 
          if(idx == 0) return filter.tostr();
          return memo + ' OR ' + filter.tostr();
        },'');
      };
    };

    window.TrueFilter = function() {
      this.filter = function(item){
        return true;
      };

      this.tostr = function(){
        return "TRUE";
      };
    },

    window.NotFilter = function(filter) {
      this.filter = function(item) {
        return !filter.filter(item);
      };

      this.tostr = function() {
        return "NOT " + filter.tostr();
      };
    };

    window.AndFilter = function(filters) {
      if(filters.length < 2) {
          throw "AND filter needs at least two filters"
      }

      this.filter = function(item) {
        for (var i = 0; i < filters.length; i++){
          var filter = filters[i];
          if (!filter.filter(item)) {
             return false;
          }
        }
        return true;
      };

      this.tostr = function() {
        return _.reduce(filters, function(memo,filter,idx){ 
          if(idx == 0) return filter.tostr();
          return memo + ' AND ' + filter.tostr();
        },'');
      };
    };

    window.PropertyRegexFilter = function(name,regex) {
      this.pattern = new RegExp(regex,'i');
      this.filter = function(item) {
        return this.pattern.test(item.get(name));
      };

      this.tostr = function() {
        return name + ' == ' + regex;
      };
    };

    window.TypeFilter = function(query) {
      this.filter = function(item){
        switch(query){
          case 'blog': 
            return item instanceof BlogItem;
          case 'gist': 
            return item instanceof Gist;
          case 'album': 
            return item instanceof Album;
          case 'page': 
            return item instanceof Page;
        }
      };

      this.tostr = function() {
        switch(query){
          case 'blog': 
            return "item is blog";
          case 'gist': 
            return "item is gist";
          case 'album': 
            return "item is album";
          case 'page': 
            return "item is page";
        }
      }
    }

    window.ViewFactory = function() {
    };

    _.extend(ViewFactory.prototype,{
      views : [],

      getView : function(model){
        var tuple = _.find(this.views, function(tuple){
          return model instanceof tuple.model;
        });

        var view = new tuple.view({model: model});
        return view;
      },

      register : function(modelobj, viewobj) {
        var tuple ={'view': viewobj, 'model': modelobj};
        this.views.push(tuple);
        if (!$.inArray(tuple,this.views)){
        }
      },
    });

    window.Item = Backbone.Model.extend({
      sync: function(method,model,options){
      },
    });

    window.Gist = Item.extend({
      sync: function(method,model,options){
      },
    });

    window.BlogItem = Item.extend({
      defaults : {
        content : "",
      },

      sync: function(method,model,options){
        var url = './blogs/' + model.get('id');
        jQuery.ajax({
          url : url,
          dataType : 'text',
          context : this,
          success : function(data){
            this.set('content',data);
            options.success.call(options.context);
          },
          error : function(data){
            Error('Oops','Something went wrong, not everything will work as it should');
          },
        });
      },
    });

    window.Page = Item.extend({
      defaults : {
        content : "",
      },

      sync: function(method,model,options){
        var url = 'http://jolos.github.com/' + model.get('path');
        jQuery.ajax({
          url : url,
          dataType : 'html',
          success : options.success,
          context : options.context,
          error : options.error,
        });
      },
    });

    window.Album = Item.extend({
      sync: function(method,model,options){
        var id = model.get('id');
        var uid = "103884336232903331378";
        var url = 'https://picasaweb.google.com/data/feed/api/user/' + uid + '/albumid/' + id +'?alt=json&imgmax=160';

       jQuery.ajax({
          url : url,
          dataType : 'jsonp',
          context : this,
          success : function(data){
           photos = data.feed.entry;
           var that = this;
           var thumbnails = [];
           _.each(photos,function(item,i){
             thumbnails.push({src: item.content.src});
           });
           this.set('thumbnails',thumbnails);
           options.success.call(options.context);
          },
          error : function(data){
            Error('Oops','Something went wrong, not everything will work as it should');
          },
        });

      },
    });

    window.GistFetcher = function(username) {
       var baseurl = 'https://api.github.com/users/' + username +'/gists'; 
       this.fetched = false;

       this.fetch = function(type_filter, callback, context) {
         if( type_filter.filter(new Gist) && !this.fetched ){
           var fetcher = this;
           var success = function(data,filters) {
             fetcher.fetched = true;
             var that = this;
             _.each(data.data, function(gist) {
               var updated_date = new Date(gist.updated_at);
               var created_date = new Date(gist.created_at);
               callback.call(that,new Gist({
                 id : gist.id,
                 title : gist.description,
                 author : gist.user.login,
                 updated : {
                   year : updated_date.getFullYear(),
                   month : updated_date.getMonth() +1,
                   day : updated_date.getDay() + 1,
                 },
                 created : {
                   year : created_date.getFullYear(),
                   month : created_date.getMonth()+1,
                   day : created_date.getDay() + 1,
                 }, 
                 files : gist.files,
               }));
             });
           };

           jQuery.ajax({
            url : baseurl,
            dataType : 'jsonp',
            context : context,
            success : success,
            error : function(data){
              Error('Oops','Something went wrong, not everything will work as it should');
            },
          });
        }
       };
    };

    window.BlogFetcher = function(jsonurl) {
       var baseurl = jsonurl; 

       this.fetched = false;
       this.fetch = function(type_filter, callback, context) {
         if( type_filter.filter(new BlogItem) && !this.fetched ){
           var fetcher = this;
           var success = function(data) {
             fetcher.fetched = true;
             var that = this;
             _.each(data, function(item) {
               var created_date = new Date(item.created);
               callback.call(that,new BlogItem({
                 id : item.id,
                 title : item.title,
                 description : item.description,
                 created : item.created,
                 created : {
                   year : created_date.getFullYear(),
                   month : created_date.getMonth()+1,
                   day : created_date.getDay() + 1,
                 }, 
                 url : item.url,
                 tags : item.tags,
               }));
             });
           };

         jQuery.ajax({
          url : baseurl,
          dataType : 'json',
          context : context,
          success : function(json){ 
            success.call(this,json);
          },
          error : function(data){
            Error('Oops','Something went wrong, not everything will work as it should');
          },
        });
       }
       };
    };

    window.PageFetcher = function(user,repo,folder) {
       var url = 'https://api.github.com/repos/'+user+'/'+repo+'/contents/'+folder;
       this.fetched = false;
       this.fetch = function(type_filter, callback, context) {
           if( type_filter.filter(new Page) && !this.fetched ){
             var fetcher = this;
             var success = function(data) {
               fetcher.fetched = true;
               var that = this;
             _.each(data.data, function(page) {
               if (page.type=='file'){
                 var page = new Page({
                   name : page.name,
                   path : page.path,
                   url : page._links.self,
                 });
                 
                 page.fetch({ 
                   success: function(content){
                     page.set('content',content);
                     callback.call(this,page); 
                   },
                   context : context,
                   error: function(content){
                     console.log('error');
                   }
                 });
               }
             });
           };

         jQuery.ajax({
            url : url,
            dataType : 'jsonp',
            data : {ref: 'master'},
            context : context,
            headers : {
              'Accept': 'application/vnd.github.beta+json'
            },
            success : success,
            error : function(data){
              Error('Oops','Something went wrong, not everything will work as it should');
            },
          });
           }
       }
    };
 
    window.PicasaFetcher = function(uid) {
       var baseurl = 'https://picasaweb.google.com/data/feed/api/user/' + uid + '?alt=json';

       this.fetched = false;
       this.fetch = function(type_filter, callback, context) {
           if( type_filter.filter(new Album) && !this.fetched ){
             var fetcher = this;
             var success = function(data) {
               fetcher.fetched = true;
               var that = this;
             _.each(data.feed.entry, function(album) {
               var updated_date = new Date(album.updated.$t);
               var created_date = new Date(album.published.$t);
               callback.call(that,new Album({
                 id : album.gphoto$id.$t,
                 title : album.title.$t,
                 description : album.summary.$t,
                 author : album.author[0].name,
                 updated : {
                   year : updated_date.getFullYear(),
                   month : updated_date.getMonth() +1,
                   day : updated_date.getDay() + 1,
                 },
                 created : {
                   year : created_date.getFullYear(),
                   month : created_date.getMonth()+1,
                   day : created_date.getDay() + 1,
                 },
                 thumbnails: album.media$group.media$thumbnail,
               }));
             });
           };

         jQuery.ajax({
            url : baseurl,
            dataType : 'jsonp',
            context : context,
            success : success,
            error : function(data){
              Error('Oops','Something went wrong, not everything will work as it should');
            },
          });
       }
       };
    };
 
    window.ItemList = Backbone.Collection.extend({
      model : Item,

      fetchers : [],

      initialize : function() {
        this.bind('add',this.percolate);
        this.filteredItems = new FilteredItemList;
      },
      
      fetch : function(type_filter) {
        var that = this;
        _.each(this.fetchers,function(fetcher, i) {
          fetcher.fetch(type_filter,function(item){ 
            this.add(item);
          }, that);
        });
      },

      percolateAll : function() {
        this.each(this.percolate,this);
      },

      percolate : function(item) {
        if(this.filter.filter(item)){
          this.filteredItems.add(item.clone());
        }
      },

      clean : function(){
        var that = this;
        var notfilter = new NotFilter(this.filter);
        var dirty_items = this.filteredItems.filter(notfilter.filter);
        _.map(dirty_items, function(item){
          item.destroy();
        });
        this.percolateAll();
      }
    });

    window.FilteredItemList = Backbone.Collection.extend({
      model: Item,

      comparator : function(item) {
        var created = item.get('created');
        if(created){
          // use ints for fast comparison
          var nmbr = created.day + created.month * 100 + created.year*10000;
          return -nmbr;
        }
        return 0;
      },
    });
 

    window.StateView = function(options){
      Backbone.View.apply(this,[options]);
    }

    _.extend(StateView.prototype, Backbone.View.prototype,{
      tagName : 'div',

      states : ['start'],

      current_state : 'start',

      transitions : {
        '*' : {},
      },
      
      setTransition : function(start_state, end_state, callback) {
        if (($.inArray(start_state, this.states) != -1 || start_state == '*') && $.inArray(end_state, this.states) != -1) {
          if (!this.transitions[start_state]) {
            this.transitions[start_state] = {};
          }
          this.transitions[start_state][end_state] = callback;
        }
      },

      doTransition: function(next_state) {
        var transitions = this.transitions[this.current_state];

        var successcallback = function(){
          this.trigger(this.current_state + '->' + next_state);
          this.$el.toggleClass(this.current_state);
          this.current_state = next_state;
          this.$el.toggleClass(this.current_state);
        }

        if (transitions && transitions[next_state]) {
          var callback = transitions[next_state];
          callback.call(this,successcallback);
        } else if (this.transitions['*'][next_state]) {
          var callback = this.transitions['*'][next_state];
          callback.call(this,successcallback);
        }
      },

      render : function(){
        data =this.preprocess(this.model)
        data.state = this.current_state;
        // use Mustache to render
        if (this.template[this.current_state]) {
          html = Mustache.render(this.template[this.current_state],data);
        } else {
          html = Mustache.render(this.template.default,data);
        }
        // replace the html of the element
        $(this.el).html(html);
        // return an instance of the view
        return this;
      },
    });

    StateView.extend = Backbone.View.extend;
    
    window.ArticleView =function(options){
      Backbone.View.apply(this,[options]);
    };

    ArticleView.extend = Backbone.View.extend;

    _.extend(ArticleView.prototype, StateView.prototype,{

      template : { 
        default : '<div class="row"><div class="three columns placeholder"></div><div class="nine columns title"><h4><i class="foundicon-photo"></i> {{title}}</h4><ul class="meta"><p> {{summary}}</p>{{#meta}}<li class="{{name}}">{{{value}}}</li>{{/meta}}</ul></div><div class="nine columns body">{{#thumbnails}} <img src="{{src}}"/>{{/thumbnails}}</div></div></div>',
      },

      events : {
        'click .title' : 'onTitleClick',
      },

      initialize : function() {
        this.$el.toggleClass('start');
        this.states.push('end');
        this.states.push('open');
        this.states.push('closed');
        this.setTransition('start', 'open',function(successcallback){
          var that = this;
          _gaq.push(['_trackEvent', 'item', 'open', this.model.get('title')]);
          that.$('.placeholder').animate({width: 0},500,'linear', function(){
            $(this).hide();
          });


          this.model.fetch({
            context : that,
            success : function(){
              that.render();
              that.$('.placeholder').hide();
              that.$('.body').slideDown(500, function(){
                that.$('.meta').slideDown(500);
              });
              successcallback.call(that); 
            },
          });
        });

        this.setTransition('closed', 'open',function(successcallback){
          var that = this;
          this.$('.placeholder').animate({width: 0},500,'linear',function(){ 
            that.$('.body').slideDown(500,function(){
              that.$('.meta').slideDown(200);
              successcallback.call(that); 
            });
          });
        });

        this.setTransition('open', 'closed',function(successcallback){
          var that = this;
          that.$('.meta').slideUp(200,function(){
            that.$('.body').slideUp(500,function(){
            that.$('.placeholder').show();
            that.$('.placeholder').animate({width: '25%'},500,'linear', function(){
              successcallback.call(that);
            });
          });
          });

        });


        this.setTransition('*', 'end', function(successcallback) {
          var that = this;
          this.$el.slideUp(500,'linear',function() {
            successcallback.call(that); 
            $(this).remove();
          });
        });

        this.model.bind('destroy', this.close, this);
      },

      close : function(){
        this.doTransition('end');
      },

      onTitleClick : function(event) {
        if (this.current_state == 'start' || this.current_state == 'closed') {
          this.doTransition('open');
        } else {
          this.doTransition('closed');
        }
      },

      preprocess : function(model) {
        var meta = [];
        var created = model.get('created');
        var updated = model.get('updated');
        meta.push({name : 'created', value: "<i class='foundicon-clock'></i><span> " +created.day + " / " + created.month + " / " + created.year + "</span>" });
        meta.push({name : 'updated', value: "<i class='foundicon-edit'></i> <span> " +updated.day + " / " + updated.month + " / " + updated.year  +"</span>"});
 
        return {
          title : model.get('title'),
          summary : model.get('description'),
          meta : meta,
        };
      },

    });

    window.AlbumView = ArticleView.extend({
      template : {
        default : '<div class="row"><div class="three columns placeholder"></div><div class="nine columns title"><h4><i class="foundicon-photo"></i> {{title}}</h4><ul class="meta"><p> {{summary}}</p>{{#meta}}<li class="{{name}}">{{{value}}}</li>{{/meta}}</ul></div><div class="nine columns body">{{#thumbnails}} <img src="{{src}}"/>{{/thumbnails}}</div></div></div>',
      },

      preprocess : function(model) {
        var meta = [];
        var created = model.get('created');
        var updated = model.get('updated');
        meta.push({name : 'link', value: "<span> <a href='https://plus.google.com/photos/103884336232903331378/albums/"+model.get('id')+"'>View at Google+</a></span>"});
        meta.push({name : 'created', value: "<i class='foundicon-clock'></i><span> " +created.day + " / " + created.month + " / " + created.year + "</span>" });
        meta.push({name : 'updated', value: "<i class='foundicon-edit'></i> <span> " +updated.day + " / " + updated.month + " / " + updated.year  +"</span>"});
        return {
          title : model.get('title'),
          thumbnails : model.get('thumbnails'),
          summary :  model.get('description'),
          meta : meta,
        };
      },
    });

    window.BlogView = ArticleView.extend({
      template : {
        default : '<div class="row"><div class="three columns placeholder"></div><div class="nine columns title"><h4>{{title}}</h4><ul class="meta"><p> {{summary}}</p>{{#meta}}<li class="{{name}}">{{{value}}}</li>{{/meta}}</ul></div><div class="nine columns body">{{{blog}}}</div></div></div>',
      },

      preprocess : function(model) {
        var meta = [];
        var created = model.get('created');
        meta.push({name : 'created', value: "<i class='foundicon-clock'></i><span> " +created.day + " / " + created.month + " / " + created.year + "</span>" });
        return {
          title : model.get('title'),
          summary :  model.get('description'),
          blog : marked(model.get('content')),
          meta : meta,
        };
      },
    });

    window.PageView = Backbone.View.extend({
      template : '<div class="row">{{{content}}}</div>',

      render : function(){
        data =this.preprocess(this.model)
        // use Mustache to render
        html = Mustache.render(this.template, data);
        // replace the html of the element
        $(this.el).html(html);
        // return an instance of the view
        return this;
      },

      preprocess : function(model) {
        return {
          content : model.get('content'),
        };
      },
    });

    window.ItemListView = Backbone.View.extend({
      el : $('#main'),

      initialize : function() {
        this.items = new ItemList();
        this.items.filteredItems.bind('add', this.addItem, this);
        //this.items.fetchers.push(new GistFetcher('jolos'));
        this.items.fetchers.push(new PicasaFetcher("103884336232903331378"));
        this.items.fetchers.push(new BlogFetcher('./json/blogs.json'));
        this.items.fetchers.push(new PageFetcher('jolos', 'jolos.github.com','pages'));
        this.factory = new ViewFactory();
        this.factory.register(Gist,ArticleView);
        this.factory.register(Album,AlbumView);
        this.factory.register(BlogItem,BlogView);
        this.factory.register(Page,PageView);
      },

      addItem : function(item) {
        var view = this.factory.getView(item);
        var html = view.render().el;
        var idx = this.items.filteredItems.indexOf(item);
        var children = $(this.el).children();
        $(view.el).hide();
        if(children.length == 0 || idx == children.length){
          $(this.el).append(html);
        } else {
          $(children[idx]).before(html);
        }
        $(view.el).slideDown(500);
        
      },

    });

    window.router = new Router;
});
