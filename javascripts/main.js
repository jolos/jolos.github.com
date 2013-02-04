define('main', ['backbone', 'underscore', 'q'],
  function (Backbone, _, Q) {
      window.error_log = function(type, msg) {
            console.log(msg); 
            _gaq.push(['_trackEvent', 'error', type, msg]);
      };

      var module = function () {
        var App = this;
      App.Router = Backbone.Router.extend({

        routes: {
          "*actions" : "default",
        },
      
        aliases : {
          '' : 'type/!page&!gist&!instapaper/title/!elastic&!profiel&!plakboek&!test&!notes',
          'all' : '/',
          'albums' : 'type/album/title/!plakboek&!profiel',
          'instapaper' : 'type/instapaper',
          'blogs' : 'type/blog',
          'about/me' : 'type/page/path/about.me',
        },

        initialize : function(){
          this.appview = new App.ItemListView;
          this.bind('route:default', function(route){
            window.document.title = " シ "+ route;
          });
          this.bind('route:default', function(route){
              _gaq.push(['_trackPageview', "/#"+ route])
          });
          this.bind('route:default',this.appview.items.clean,this.appview.items);
          this.bind('route:default',draw);
          this.fetchers = [];

          var that = this;

          require(['fetchers'], function (Fetchers) {
            // TODO: load fetchers
            //that.items.fetchers.push(new TestFetcher('json', './blogs.json'));
            that.fetchers.push(new Fetchers.GistFetcher('jolos'));
            that.fetchers.push(new Fetchers.PicasaFetcher("103884336232903331378"));
            that.fetchers.push(new Fetchers.BlogFetcher('./blogs.json'));
            that.fetchers.push(new Fetchers.PageFetcher('jolos', 'jolos.github.com','pages'));
            that.fetchers.push(new Fetchers.InstaPaperFetcher('http://www.instapaper.com/starred/rss/2609795/rU9MxwxnbvWbQs3kHyhdoLkeGbU'));
            Backbone.history.start();
          });
        },

        fetch: function (filter) {
          var promises = [];
          var itemlist = this.appview.items;
          var additem = function (item) {
            itemlist.add(item);
            return item;
          };
          _.each(this.fetchers, function (fetcher) {
            var promise = fetcher.fetch(filter);
            promise.then(function (promiselist) {
              _.each(promiselist, function (promise) {
                promises.push(promise.then(additem));
              });
            });
          });
          // TODO: return a Q.all promise.
        },

        default : function(actions){
          var alias = this.aliases[actions];

          if (alias) {
            var path = _.filter(alias.split("/"),function(str){ return str });
          } else {
            var path = _.filter(actions.split("/"),function(str){ return str });
          }
          // This function connects all the parts

          try {
            var filters = [];

            var typefilters = []

            while (path.length !=0) {
              var name = path.shift();
              var parser = new App.FilterParser(name);
              var query =path.shift();
              var filter = parser.parse(query);
              if (name == 'type'){
               typefilters.push(filter); 
              } 
              filters.push(filter); 
            }
            
            var filter;
            if( filters.length > 1 ) {
              var filter = new App.AndFilter(filters);
            } else if(filters.length == 1) {
              var filter = filters[0];
            } else {
              var filter = new App.TrueFilter();
            }
            
            filter = new App.TrueFilter();

            this.appview.items.filter = filter;

            this.fetch(filter);
            /* 
            if( typefilters.length > 1 ) {
              //this.appview.items.fetch(new AndFilter(typefilters));
              this.fetch(new AndFilter(typefilters));
            } else if(typefilters.length == 1) {
              //this.appview.items.fetch(typefilters[0]);
              this.fetch(typefilters[0]);
            } else {
              this.fetch(new TrueFilter());
            }*/
          } catch(err) {
            error_log('general', err.message);
          }
        },
      });

      App.FilterParser = function(name) {

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
            return new App.AndFilter(_.map(subqueries,this.parse,this));
          }
          return false;
        };

        this.parseOr = function(query) {
          if(query.indexOf('|') != -1){
            var subqueries = query.split('|');
            return new App.OrFilter(_.map(subqueries,this.parse,this));
          }
          return false;
        };

        this.parseNot = function(query) {
          if(query.indexOf('!') != -1){
            var subquery = query.substring(1);
            return new App.NotFilter(this.parse(subquery));
          }
          return false;
        };

        this.parseDefault = function(query) {
          if (name == 'type'){
            return new App.TypeFilter(query);
          }
          return new App.PropertyRegexFilter(name,query);
        };
      };

      App.FilterFactory = function(defaultFilter) {
        this.default = defaultFilter;
      };

      _.extend(App.FilterFactory.prototype,{
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

      App.OrFilter = function(filters) {
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

      App.TrueFilter = function() {
        this.filter = function(item){
          return true;
        };

        this.tostr = function(){
          return "TRUE";
        };
      };

      App.NotFilter = function(filter) {
        this.filter = function(item) {
          return !filter.filter(item);
        };

        this.tostr = function() {
          return "NOT " + filter.tostr();
        };
      };

      this.AndFilter = function(filters) {
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

    App.PropertyRegexFilter = function(name,regex) {
      this.pattern = new RegExp(regex,'i');
      this.filter = function(item) {
        return this.pattern.test(item.get(name));
      };

      this.tostr = function() {
        return name + ' == ' + regex;
      };
    };

    App.TypeFilter = function(query) {
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
          case 'instapaper': 
            return item instanceof InstaPaper;
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
          case 'instapaper': 
            return "item is instapaper";
        }
      }
    }

   App.ItemList = Backbone.Collection.extend({

    fetchers : [],

    initialize : function() {
      this.bind('add',this.percolate);
      this.filteredItems = new App.FilteredItemList;
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
      var notfilter = new App.NotFilter(this.filter);
      var dirty_items = this.filteredItems.filter(notfilter.filter);
      _.map(dirty_items, function(item){
        item.destroy();
      });
      this.percolateAll();
    }
  });

  App.FilteredItemList = Backbone.Collection.extend({

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


    App.ItemListView = Backbone.View.extend({
        el : $('#main'),

        initialize : function() {
          this.items = new App.ItemList;

          var that = this;
          require(['views', 'models'], function (Views, Models) {
            that.factory = new Views.ViewFactory;
            that.factory.register(Models.Gist, Views.GistView);
            that.factory.register(Models.Album, Views.AlbumView);
            that.factory.register(Models.BlogItem, Views.BlogView);
            that.factory.register(Models.Page, Views.PageView);
            that.factory.register(Models.InstaPaper, Views.InstaPaperView);
            that.items.filteredItems.bind('add', that.addItem, that);
            // render the items.
            that.items.filteredItems.each(that.addItem, that);
          });
          // filtertlist. and start percolating.
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

      };
      return new module();
  });
