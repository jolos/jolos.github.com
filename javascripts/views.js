define('views',['backbone', 'underscore','mustache', 'q'],
  function(Backbone, _, Mustache, Q) {
    var module = function() {
      // TODO: StateView could be a mixin instead of a full blown object.
      this.StateView = function(options){
        Backbone.View.apply(this,[options]);
      }

      _.extend(
        this.StateView.prototype, 
        Backbone.View.prototype,{
        tagName : 'div',

        states : ['start'],

        current_state : 'start',

        transitions : {
          '*' : {},
        },

        getCurrentState : function() {
          return this.current_state;
        },
        
        // callback should always return a promise.
        setTransition : function(start_state, end_state, callback) {
          if (($.inArray(start_state, this.states) != -1 || start_state == '*') && $.inArray(end_state, this.states) != -1) {
            if (!this.transitions[start_state]) {
              this.transitions[start_state] = {};
            }
            this.transitions[start_state][end_state] = callback;
          }
        },

        doTransition: function(next_state, quiet=false) {
          var transitions = this.transitions[this.current_state];

          var that = this;;
          var successcallback = function(){
            var prev_state = that.current_state;
            that.current_state = next_state;
            // Trigger the event.
            if (!quiet){
              that.trigger(prev_state + ':' + next_state);
            }
          }

          if (transitions && transitions[next_state]) {
            var callback = transitions[next_state];
             var promise = callback.call(this);
             promise.done(successcallback);
             return promise;
          } else if (this.transitions['*'][next_state]) {
            var callback = this.transitions['*'][next_state];
            var promise = callback.call(this);
            promise.done(successcallback);
            return promise;
          }
          
          return Q.reject('unvalid-state');
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

      this.StateView.extend = Backbone.View.extend;
      
      this.ArticleView =function(options){
        Backbone.View.apply(this,[options]);
      };

      this.ArticleView.extend = Backbone.View.extend;

      _.extend(
          this.ArticleView.prototype, 
          this.StateView.prototype,{

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
                successcallback.call(that); 
                that.render();
                that.$('.placeholder').hide();
                that.$('.body').slideDown(500, function(){
                  that.$('.meta').slideDown(500);
                });
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

      this.AlbumView = this.ArticleView.extend({
        template : {
          default : '<div class="row"><div class="three columns placeholder"></div><div class="nine columns title"><h4><i class="foundicon-photo"></i> {{title}}</h4><ul class="meta"><p> {{summary}}</p>{{#meta}}<li class="{{name}}">{{{value}}}</li>{{/meta}}</ul></div><div class="nine columns body">{{#thumbnails}} <a href="{{src}}"><img src="{{thumbsrc}}"/></a>{{/thumbnails}}</div></div></div>',
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
          if (this.current_state != 'start'){
            this.$('.body a').colorbox({rel: 'thumbnails'});
          }
          // return an instance of the view
          return this;
        },


        preprocess : function(model) {
          var meta = [];
          var created = model.get('created');
          var updated = model.get('updated');
          meta.push({name : 'link', value: "<span> <a href='https://plus.google.com/photos/103884336232903331378/albums/"+model.get('id')+"'>View at Google+</a></span>"});
          meta.push({name : 'created', value: "<i class='foundicon-clock'></i><span> " +created.day + " / " + created.month + " / " + created.year + "</span>" });
          meta.push({name : 'updated', value: "<i class='foundicon-edit'></i> <span> " +updated.day + " / " + updated.month + " / " + updated.year  +"</span>"});
          // @todo : show tags in meta

          return {
            title : model.get('title'),
            thumbnails : model.get('thumbnails'),
            summary :  model.get('description'),
            meta : meta,
          };
        },
      });

      this.GistView = this.ArticleView.extend({
        template : {
              default : '<div class="row"><div class="three columns placeholder"></div><div class="nine columns title"><h4>{{title}}</h4><ul class="meta">{{#meta}}<li class="{{name}}">{{{value}}}</li>{{/meta}}</ul></div><div class="nine columns body">{{{body}}}</div></div></div>',
        },

        preprocess : function(model) {
          var meta = [];
          var created = model.get('created');
          var updated = model.get('updated');
          meta.push({name : 'link', value: "<span> <a href='"+model.get('html_url')+"'>View at Github</a></span>"});
          meta.push({name : 'created', value: "<i class='foundicon-clock'></i><span> " +created.day + " / " + created.month + " / " + created.year + "</span>" });
          meta.push({name : 'updated', value: "<i class='foundicon-edit'></i> <span> " +updated.day + " / " + updated.month + " / " + updated.year  +"</span>"});

          var body = "";
          if (this.current_state != 'start') {
            _.each(model.get('files'), function(file) {
              switch(file.type) {
                case 'text/plain' :
                  body +=marked(file.content);
                  break;
                case 'text/html':
                  body += file.content;
                  break;
                case 'image/png' :
                  body += "<img src='" + file.raw_url + "/>";
                  break;
                default:
                  // @todo: check if file.language is supported
                  body += "<hr/><pre>"+hljs.highlight(file.language.toLowerCase(), file.content).value+"</pre><hr/>";
                  break;
              }
            });
          }


          return {
            title : model.get('title'),
            body : body,
            meta : meta,
          };
        },

      });

      this.BlogView = this.ArticleView.extend({
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

      this.InstaPaperView = Backbone.View.extend({
        template :  '<div class="row instapaper"><div class="three columns"></div><div class="nine columns"><h4><a href="{{url}}"><i class="foundicon-star"></i> {{url_shortened}}</a></h4><p>{{title}} </p><p>{{{summary}}}</p></div></div>',

        events : {
          "click h4" : "track",
        },

        track : function(){
         _gaq.push(['_trackEvent', 'item', 'open', this.model.get('title')]);
        },

        initialize : function(){
          this.model.bind('destroy', this.remove, this);
        },

        remove : function(){
          this.$el.remove();
        },

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

          var created = model.get('created');
          var created_str = created.day + " / " + created.month + " / " + created.year;
          var url_shortened = model.get('url');
          if (url_shortened.length > 40){
              url_shortened = url_shortened.substring(0,40) + " ... ";
            }
            return {
              title : model.get('title'),
              summary :  model.get('description'),
              url : model.get('url'),
              url_shortened : url_shortened,
              created : created_str,
            };
          },
        });


        this.PageView = Backbone.View.extend({
          template : '<div class="row">{{{content}}}</div>',

          initialize : function(){
            this.model.bind('destroy', this.remove, this);
          },

          remove : function(){
            this.$el.remove();
          },

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
    }
    return new module();
  }
);
