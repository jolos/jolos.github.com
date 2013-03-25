/*jslint indent: 2, browser: true */
/*global define, jQuery, $*/
define('views', ['backbone', 'underscore', 'mustache', 'q'],
  function (Backbone, _, Mustache, Q) {
    'use strict';
    var module = function () {
      this.StateViewMixin = (function () {
        var getCurrentState, setCurrentState, getPromisedState, setTransition, doTransition, render;
        getCurrentState = function () {
          return this.current_state;
        };

        getPromisedState = function () {
          return this.promised_state;
        };

        setCurrentState = function (state) {
          this.current_state = state;
        };

        // callback should always return a promise.
        setTransition = function (start_state, end_state, callback) {
          if (($.inArray(start_state, this.states) !== -1 || start_state === '*') && $.inArray(end_state, this.states) !== -1) {
            if (!this.transitions[start_state]) {
              this.transitions[start_state] = {};
            }
            this.transitions[start_state][end_state] = callback;
          }
        };

        doTransition = function (next_state, silent) {
          var promise, transitions, that, successcallback, deferred, callback;
          //transitions = this.transitions[this.getCurrentState()];
          that = this;
          console.time(this.cid + " " + this.getCurrentState() +"->"+ next_state);

          var getTransitionPromise = function (state, next_state) {
              var promise, transitions;
              transitions = that.transitions[state];
              if (transitions && transitions[next_state]) {
                callback = transitions[next_state];
              } else if (that.transitions['*'][next_state]) {
                callback = that.transitions['*'][next_state];
              } else {
                console.log("err: " +state + ":" + next_state);
                return Q.reject('invalid');
              }

              /*var d = Q.defer();

              promise = d.promise.then(function () {
                return callback.call(that);
              })*/

              promise = callback.call(that);

              if (silent == undefined || silent == false) {
                promise = promise.then(function () {
                  that.trigger("state:" + next_state, that.getCurrentState(), next_state);
                });
              }

              return promise;
          };
          
          var promised_state = this.getPromisedState();
          if (promised_state.isPending()) {
            promise = promised_state.then(function (state) {
              return getTransitionPromise(state, next_state)

            });
            
            this.promised_state = promise
              .then(function () {
                return next_state;
              });
          } else {
            this.deferred = Q.defer();
            this.promised_state = this.deferred.promise;
            promise = getTransitionPromise(this.getCurrentState(), next_state)
              .fin(function () {
                console.timeEnd(that.cid + " "+ that.getCurrentState() +"->"+ next_state);
                that.setCurrentState(next_state);
                that.deferred.resolve(next_state);
              });
          }
        
          // TODO: it might be usefull to return a deferred instead of a
          // promise.
          return promise;
        };

        render = function () {
          var that = this;
          var state = this.getCurrentState();
          var html, data;
          data = that.preprocess(that.model);
          data.state = state;
          // use Mustache to render
          if (that.template[state]) {
            html = Mustache.render(that.template[state], data);
          } else {
            html = Mustache.render(that.template.default_state, data);
          }
          // replace the html of the element
          $(that.el).html(html);
          // return an instance of the view
          return this;
        };

        return function () {
          this.tagName = 'div';
          this.states = ['start'];
          this.current_state = 'start';
          this.promised_state = Q.fulfill('start');
          this.transitions = {
            '*' : {}
          };
          this.render = render;
          this.doTransition = doTransition;
          this.setTransition = setTransition;
          this.getCurrentState = getCurrentState;
          this.getPromisedState = getPromisedState;
          this.setCurrentState = setCurrentState;
          this.extend = Backbone.View.extend;
        };
      })();

      // TODO: StateView is deprecated.
      this.StateView = function (options) {
        Backbone.View.apply(this, [options]);
      };

      _.extend(this.StateView.prototype, Backbone.View.prototype);

      this.StateViewMixin.call(this.StateView.prototype);
      
      this.ArticleView = function (options) {
        Backbone.View.apply(this, [options]);
      };

      this.ArticleView.extend = Backbone.View.extend;

      _.extend(
        this.ArticleView.prototype,
        this.StateView.prototype,
        {
          template : {
            default_state : '<div class="row"><div class="twelve columns title"><h4><i class="foundicon-photo"></i> {{title}}</h4><ul class="meta"><p> {{summary}}</p>{{#meta}}<li class="{{name}}">{{{value}}}</li>{{/meta}}</ul></div><div class="nine columns body">{{#thumbnails}} <img src="{{src}}"/>{{/thumbnails}}</div></div></div>'
          },
          events : {
            'click .title' : 'onTitleClick'
          },
          initialize : function () {
            this.$el.toggleClass('start');
            this.states.push('end');
            this.states.push('open');
            this.states.push('closed');
            this.setTransition('start', 'open', function () {
              var that = this;
              _gaq.push(['_trackEvent', 'item', 'open', this.model.get('title')]);
              that.$('.placeholder').animate({width: 0}, 500, 'linear', function () {
                $(this).hide();
              });

              return that.model.fetch()
                .then(function () {
                  that.render();
                  that.$('.placeholder').hide();
                  var deffered = Q.defer();
                  that.$('.body').slideDown(500, function () {
                    that.$('.meta').slideDown(500);
                    // TODO: pass smth sensible as the resolve argument.
                    deffered.resolve(that);
                  });
                  return deffered.promise;
                });
            });

            this.setTransition('closed', 'open', function () {
              var deffered = Q.defer();
              var that = this;
              this.$('.placeholder').animate({width: 0}, 500, 'linear', function () {
                that.$('.body').slideDown(500, function () {
                  that.$('.meta').slideDown(200);
                  deffered.resolve(that);
                });
              });
              return deffered.promise;
            });

            this.setTransition('open', 'closed', function () {
              var that, deffered;
              that = this;
              deffered = Q.defer();

              that.$('.meta').slideUp(200, function () {
                that.$('.body').slideUp(500, function () {
                  that.$('.placeholder').show();
                  that.$('.placeholder').animate({width: '25%'}, 500, 'linear', function () {
                    deffered.resolve(that);
                  });
                });
              });
              return deffered.promise;
            });

            this.setTransition('*', 'end', function () {
              var that, deffered;
              that = this;
              deffered = Q.defer();
              this.$el.slideUp(500, 'linear', function () {
                deffered.resolve(that);
                $(this).remove();
              });
              return deffered.promise;
            });

            this.model.bind('destroy', this.close, this);
          },
          close : function () {
            this.doTransition('end');
          },
          onTitleClick : function (event) {
            if (this.current_state == 'start' || this.current_state == 'closed') {
              this.doTransition('open');
            } else {
              this.doTransition('closed');
            }
          },
          preprocess : function (model) {
            var meta, created, updated;
            meta = [];
            created = model.get('created');
            updated = model.get('updated');
            meta.push({
              name : 'created',
              value: "<i class='foundicon-clock'></i><span> " + created.day + " / " + created.month + " / " + created.year + "</span>"
            });
            meta.push({
              name : 'updated',
              value: "<i class='foundicon-edit'></i> <span> " + updated.day + " / " + updated.month + " / " + updated.year  + "</span>"
            });

            return {
              title : model.get('title'),
              summary : model.get('description'),
              meta : meta
            };
          }
        }
      );
 
      this.ItemView = function (options) {
        Backbone.View.apply(this, [options]);
      };

      this.ItemView.extend = Backbone.View.extend;

      _.extend(
        this.ItemView.prototype,
        this.StateView.prototype,
        {
        template : {
          closed : '<div class="row"><div class="twelve columns title"><h4><i class="foundicon-photo"></i> {{title}} (closed)</h4></div></div>',
          start : '<div class="row"><div class="twelve columns title"><h4><i class="foundicon-photo"></i> {{title}} (start)</h4></div></div>',
          default_state : '<div class="row"><div class="twelve columns title"><h4><i class="foundicon-photo"></i> {{title}} (open)</h4><ul class="meta">{{#meta}}<li class="{{name}}">{{{value}}}</li>{{/meta}}</ul></div></div>'
        },
        events : {
          'click .title' : 'onTitleClick'
        },
        initialize : function () {
          this.$el.toggleClass('start');
          this.states.push('end');
          this.states.push('open');
          this.states.push('closed');
          this.setTransition('start', 'open', function () {
            var that = this;
            _gaq.push(['_trackEvent', 'item', 'open', this.model.get('title')]);
            that.$('.placeholder').animate({width: 0}, 500, 'linear', function () {
              $(this).hide();
            });

            return that.model.fetch()
                .then(function () {
                  that.render();
                  return Q.fulfill(that);
                });
          });

          this.setTransition('closed', 'open', function () {
             this.render();
             return Q.fulfill('ok');
          });

          this.setTransition('open', 'closed', function () {
            this.render();
            return Q.fulfill('ok');
          });

          this.setTransition('*', 'end', function () {
            var that, deffered;
            that = this;
            deffered = Q.defer();
            this.$el.slideUp(500, 'linear', function () {
              deffered.resolve(that);
              $(this).remove();
            });
            return Q.fulfill();
          });

          this.model.bind('destroy', this.close, this);
        },
        close : function () {
          this.doTransition('end');
        },
        onTitleClick : function (event) {
          if (this.current_state == 'start' || this.current_state == 'closed') {
            this.doTransition('open');
          } else {
            this.doTransition('closed');
          }
        },
        preprocess : function (model) {
          var meta, created, updated;
          meta = [];
          created = model.get('created');
          updated = model.get('updated');
          if (created) {
            meta.push({
              name : 'created',
              value: "<i class='foundicon-clock'></i><span> " + created.day + " / " + created.month + " / " + created.year + "</span>"
            });
          }

          if (updated) {
            meta.push({
              name : 'updated',
              value: "<i class='foundicon-edit'></i> <span> " + updated.day + " / " + updated.month + " / " + updated.year  + "</span>"
            });
          }

          return {
            title : model.get('title'),
            summary : model.get('description'),
            meta : meta
          };
        }
      });

      this.AlbumView = this.ArticleView.extend({
        template : {
          default_state : '<div class="row"><div class="three columns placeholder"></div><div class="nine columns title"><h4><i class="foundicon-photo"></i> {{title}}</h4><ul class="meta"><p> {{summary}}</p>{{#meta}}<li class="{{name}}">{{{value}}}</li>{{/meta}}</ul></div><div class="nine columns body">{{#thumbnails}} <a href="{{src}}"><img src="{{thumbsrc}}"/></a>{{/thumbnails}}</div></div></div>'
        },

        render : function () {
          var data, html;
          data = this.preprocess(this.model);
          data.state = this.current_state;
          // use Mustache to render
          $(this.el).html(data.state);
          return this;
          /*return this;
          if (this.template[this.current_state]) {
            html = Mustache.render(this.template[this.current_state], data);
          } else {
            html = Mustache.render(this.template.default_state, data);
          }
          // replace the html of the element
          $(this.el).html(html);
          if (this.current_state != 'start') {
            this.$('.body a').colorbox({rel: 'thumbnails'});
          }
          // return an instance of the view
          return this;*/
        },


        preprocess : function (model) {
          var meta, created, updated;
          meta = [];
          created = model.get('created');
          updated = model.get('updated');
          meta.push({name : 'link', value: "<span> <a href='https://plus.google.com/photos/103884336232903331378/albums/"+model.get('id')+"'>View at Google+</a></span>"});
          meta.push({name : 'created', value: "<i class='foundicon-clock'></i><span> " +created.day + " / " + created.month + " / " + created.year + "</span>" });
          meta.push({name : 'updated', value: "<i class='foundicon-edit'></i> <span> " +updated.day + " / " + updated.month + " / " + updated.year  +"</span>"});
          // @todo : show tags in meta

          return {
            title : model.get('title'),
            thumbnails : model.get('thumbnails'),
            summary :  model.get('description'),
            meta : meta
          };
        }
      });

      this.AlbumView2 = Backbone.View.extend({
        template : '<div class="row"><div class="three columns placeholder"></div><div class="nine columns title"><h4><i class="foundicon-photo"></i> {{title}}</h4><ul class="meta"><p> {{summary}}</p>{{#meta}}<li class="{{name}}">{{{value}}}</li>{{/meta}}</ul></div><div class="nine columns body">{{#thumbnails}} <a href="{{src}}"><img src="{{thumbsrc}}"/></a>{{/thumbnails}}</div></div></div>' ,

        render : function () {
          var data, html;
          data = this.preprocess(this.model);
          html = Mustache.render(this.template, data);
          // replace the html of the element
          $(this.el).html(html);
          this.$('.body a').colorbox({rel: 'thumbnails'});
          // return an instance of the view
          return this;
        },


        preprocess : function (model) {
          var meta, created, updated;
          meta = [];
          created = model.get('created');
          updated = model.get('updated');
          meta.push({name : 'link', value: "<span> <a href='https://plus.google.com/photos/103884336232903331378/albums/"+model.get('id')+"'>View at Google+</a></span>"});
          meta.push({name : 'created', value: "<i class='foundicon-clock'></i><span> " +created.day + " / " + created.month + " / " + created.year + "</span>" });
          meta.push({name : 'updated', value: "<i class='foundicon-edit'></i> <span> " +updated.day + " / " + updated.month + " / " + updated.year  +"</span>"});
          // @todo : show tags in meta

          return {
            title : model.get('title'),
            thumbnails : model.get('thumbnails'),
            summary :  model.get('description'),
            meta : meta
          };
        }
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
            meta : meta
          };
        },

      });

      this.BlogView = this.ArticleView.extend({
        template : {
          default_state : '<div class="row"><div class="three columns placeholder"></div><div class="nine columns title"><h4>{{title}}</h4><ul class="meta"><p> {{summary}}</p>{{#meta}}<li class="{{name}}">{{{value}}}</li>{{/meta}}</ul></div><div class="nine columns body">{{{blog}}}</div></div></div>',
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
          var data, html;
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
            var data, html;
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

      this.ViewFactory = function() {
        this.views = [];
      }

      _.extend(this.ViewFactory.prototype,{
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

      this.MainView = Backbone.View.extend({
        el: $('#main'),

        render: function () {
          this.view = this.factory.getView(this.model);
          var html = this.view.render().el;
          $(this.el).html(html);
          return this;
        }
      });

      this.ItemListView = Backbone.View.extend({
        el : $('#items'),

        constructor : function (attributes, options) {
          this.items = attributes.items;
          this.factory = attributes.factory;
          Backbone.View.apply(this, arguments);
          this.views = [];
          this.states.push('empty');
          this.states.push('open');
          this.states.push('closed');
          this.states.push('end');
          var that = this;

          this.items.bind('remove', function (model) {
            _.each(that.views, function (v) {
              if (v.model === model) {
                v.doTransition('end');
              }
            });
          }, this.items);

          this.setTransition('start', 'empty', function () {
            return Q.fulfill('empty');
          });

          this .setTransition('closed', 'closed', function () {
            return Q.fulfill('closed');
          });

          this.setTransition('empty', 'closed', function () {
            return Q.fulfill('closed');
            if (this.views.length == 1) {
              return this.views[0].doTransition('open', true);
            }
            return Q.fulfill('ok');
          });

          this.setTransition('open', 'closed', function () {
            var promises = [];
            _.each(this.views, function (view) {
              promises.push(view.getPromisedState().then(function (state) {
                if (state == 'open') {
                  view.doTransition('closed', true);
                }
              }));
            });
            return Q.all(promises);
          });

          this.setTransition('open', 'open', function () {
            return Q.fulfill(this.getActiveItem());
          });

          this.setTransition('closed', 'open', function () {
            return Q.fulfill(this.getActiveItem());
          });

          this.setTransition('closed', 'empty', function () {
            return Q.fulfill('empty');
          });

          this.setTransition('open', 'empty', function () {
            return Q.fulfill('ok');
          });

          this.doTransition('empty');
        },

        getActiveItem : function () {
          for (var v in this.views) {
            if (this.views[v].getCurrentState() == 'open') {
              return this.views[v];
            }
          }
        },

        bindToView : function (view) {
          var that = this;
          view.bind('state:end', function (prev_state, promise) {
            // When a view is destroyed we have to remove it from the array.
            that.views = _.filter(that.views, function (it) {
              return it.cid != view.cid;
            });

            /*
            promise.fin(function () {
              if (that.views.length == 0) {
                that.doTransition('empty');
              } else if (that.views.length == 1) {
                that.views[0].doTransition('open');
              }
            });*/
          });

          view.bind('state:open', function (evt, promise) {
            view.getPromisedState().then(function (state) {
              view.render();
            });
            var promises = [];
            // Ensure all other itemviews are closed.
            _.each(that.views, function (v) {
              var p = v.getPromisedState().then(function (state) {
                if (state == 'open' && v !== view) {
                  return v.doTransition('closed', true);
                }
                return Q.fulfill(state);
              });
              promises.push(p);
            });

            promises.push(promise);

            if (promises.length !=0) {
              Q.all(promises).then(function () {
                that.doTransition('open');
              }).done();
            } else {
                that.doTransition('open');
            }

            // TODO: if promise failed, revert state change. <-- should be done,
            // by itemviews.
            
          }, view);

          view.bind('state:closed', function (evt, promise) {
            view.getPromisedState().then(function (state) {
              view.render();
            });

            that.doTransition('closed');
            /*that.getPromisedState().then(function (state) {
              if (state == 'open'){
                that.doTransition('closed');
              }
            });*/
          });
        },

        addItem : function (item) {
          var view, html, idx, children;
          view = this.factory.getView(item);

          this.bindToView(view);
         
          this.views.push(view);

          // Render the view.

          html = view.render().el;
          idx = this.items.indexOf(item);
          children = $(this.el).children();
          $(view.el).hide();
          if(children.length == 0 || idx == children.length){
            $(this.el).append(html);
          } else {
            $(children[idx]).before(html);
          }
          $(view.el).slideDown(500);

          if (this.getCurrentState() == 'empty') {
            this.doTransition('closed');
          }
        }
      });

      this.StateViewMixin.call(this.ItemListView.prototype);
   }
    return new module();
  }
);
