/*jslint indent: 2, browser: true */
/*global define, jQuery, $*/
define('views', ['backbone', 'underscore', 'mustache', 'q', 'templates'],
  function (Backbone, _, Mustache, Q, templates) {
    'use strict';
    var module = function () {
      var Views = this;

      this.StateMixin = (function () {
        var getCurrentState, setCurrentState, getPromisedState, setTransition, doTransition;
        getCurrentState = function () {
          return this.current_state;
        };

        // Get a promise for the current state.
        // This can be useful if there's a state transition going on, and you want
        // to wait for this transition to finish before running your code.
        getPromisedState = function () {
          return this.promised_state;
        };

        setCurrentState = function (state) {
          this.current_state = state;
        };

        // Set a transition callback. This transition callback should always
        // return a promise. ( If you're not doing asynchronous stuff, you
        // can return a Q.fulfill )
        setTransition = function (start_state, end_state, callback) {
          if (($.inArray(start_state, this.states) !== -1 || start_state === '*') 
           && ($.inArray(end_state, this.states) !== -1) || end_state === '*') {
            if (!this.transitions[start_state]) {
              this.transitions[start_state] = {};
            }
            this.transitions[start_state][end_state] = callback;
          }
        };

        // Queue a state transition.
        doTransition = function (next_state, silent) {
          var promise, transitions, that, successcallback, deferred, callback, promised_state = this.getPromisedState(), getTransitionPromise;
          //transitions = this.transitions[this.getCurrentState()];
          that = this;
          console.time(this.cid + " " + this.getCurrentState() +"->"+ next_state);

          getTransitionPromise = function (state, next_state) {
            var promise, transitions;
            transitions = that.transitions[state];
            if (transitions && transitions[next_state]) {
              // Normal case, a transition callback is available.
              callback = transitions[next_state];
            } else if (that.transitions['*'][next_state]) {
              // Check if there's a wildcard transition callback available.
              callback = that.transitions['*'][next_state];
            } else if (transitions && transitions['*']) {
              // Check if there's a wildcard callback available for getting
              // into the next state.
              callback = transitions['*'];
            } else {
              // We couldn't find any statechange callback, this means this is
              // an invalid transition.
              console.log("err: " + state + ":" + next_state);
              return Q.reject('invalid');
            }

            // We get the promise from the transition callback.
            promise = callback.call(that);

            if (silent == undefined || silent == false) {
              // Fire an event to warn listeners that a state transition has
              // been started.
              that.trigger('state:' + next_state, promise, state);
            }

            return promise;
          };
          
          if (promised_state.isPending()) {
            promise = promised_state.then(function (state) {
              return getTransitionPromise(state, next_state);
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
        
          return promise;
        };

        return function () {
          this.tagName = 'div';
          this.states = ['start'];
          this.current_state = 'start';
          this.promised_state = Q.fulfill('start');
          this.transitions = {
            '*' : {}
          };
          this.doTransition = doTransition;
          this.setTransition = setTransition;
          this.getCurrentState = getCurrentState;
          this.getPromisedState = getPromisedState;
          this.setCurrentState = setCurrentState;
          this.extend = Backbone.View.extend;
        };
      })();

      this.StateView = function (options) {
        Backbone.View.apply(this, [options]);
      };

      _.extend(this.StateView.prototype, Backbone.View.prototype);

      this.StateView.extend = Backbone.View.extend;

      this.StateMixin.call(this.StateView.prototype);

      this.StateView.prototype.render = function () {
        var html, template, data, state = this.getCurrentState();
        data = this.preprocess(this.model);
        data.state = state;
        // use Mustache to render
        if (this.template[state]) {
          template = this.template[state];
        } else {
          template = this.template['default_state'];
        }

        if (typeof(template) == "function") {
          html = template(data);
        } else {
          html = Mustache.render(template, data);
        }
        // replace the html of the element
        $(this.el).html(html);
        // return an instance of the view
        return this;
      };

      this.ScrollPagerMixin = (function () {
        var nextPage, prevPage, getHeight, getParent, seekToPage, initialize, isValidPage, getTotal, getInnerHeight;
        // TODO: don't use #main
        // TODO: add extra height to view to make it a multiple.
        //
        getHeight = function () {
          return this.$el.parent().height();
        };

        getInnerHeight = function (el) {
          return el.outerHeight();
        };

        getTotal = function () {
          return Math.ceil(getInnerHeight(this.$el) / this.$el.parent().innerHeight());
        };

        isValidPage = function (page) {
          return (page >= 0 && page < this.getTotal());
        };

        seekToPage = function (page) {
          if (!this.scroll_lock && isValidPage.call(this, page)) {
            this.scroll_lock = true;
            var that = this;

            this.$el.animate({
              top: '-' + (this.$el.parent().innerHeight() * page) + 'px'
            }, this.scroll_duration, function () {
              that.page = page;
              that.scroll_lock = false;
              that.trigger('change:page', page, 5);
            });
          }
        };

        nextPage = function () {
          this.seekToPage(this.page + 1);
        };

        prevPage = function () {
          this.seekToPage(this.page - 1);
        };

        initialize = function () {
          this.$el.css({
            position: 'relative',
            overflow: 'hidden'
          });
        };
        
        return function () {
          this.page = 0;
          this.scroll_duration = 1000;
          this.scroll_lock = false;
          this.extend = Backbone.View.extend;
          this.nextPage = nextPage;
          this.hasNext = function () {
            return isValidPage.call(this, this.page + 1);
          };

          this.prevPage = prevPage;

          this.hasPrev = function () {
            return isValidPage.call(this, this.page - 1);
          };

          this.seekToPage = seekToPage;
          this.getTotal = getTotal;
          if (this.initialize) {
            var super_initialize = this.initialize;
          }

          this.initialize = function () {
            if (super_initialize) {
              super_initialize.call(this);
            }
            initialize.call(this);
          };
        };
      })();
      
      this.PagerView = Backbone.View.extend({
        template : '<a class="prev">{{prev}}</a><div>{{current_page}} / {{total_pages}}</div><a class="next">{{next}}</a>',
        constructor : function (attributes, options) {
          this.view = attributes.view;
          Backbone.View.apply(this, arguments);
        },
        initialize : function () {
          this.view.on('change:page', this.render, this);
          this.render(0, 0);

        },

        render : function () {
          var data, html, that = this;
          data = {
            current_page : this.view.page + 1, // Add 1 because we start counting at 0
            total_pages : this.view.getTotal(),
            prev: '<',
            next: '>'
          };

          html = Mustache.render(this.template, data);
          this.$el.html(html);
          if (!this.view.hasPrev()) {
            $('.prev', this.el).removeClass('active');

          } else {
            $('.prev', this.el).addClass('active');

            // Meh:
            // http://ianstormtaylor.com/rendering-views-in-backbonejs-isnt-always-simple/
            $('.prev', this.el).bind('click', function () {
              that.view.prevPage();
            });
          }

          if (!this.view.hasNext()) {
            $('.next', this.el).removeClass('active');
          } else {
            $('.next', this.el).addClass('active');

            $('.next', this.el).bind('click', function () {
              that.view.nextPage();
            });
 
          }
          return this.el;
        }
      });

      // TODO: articleview can be removed.
      this.ArticleView = function (options) {
        Backbone.View.apply(this, [options]);
      };

      this.ArticleView.extend = Backbone.View.extend;

      _.extend(
        this.ArticleView.prototype,
        this.StateView.prototype,
        {
          template : {
            default_state : '<section class="section"><p class="title">{{title}}</p><div class="content">{{summary}}</div></section>'
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

      this.ItemView = this.StateView.extend({
        tagName: "section",
        // TODO: provide a way to have different icons for different types of
        // items.
        template : templates.item,

        events : {
          'click .title' : 'onTitleClick'
        },
        setCurrentState : function (state) {
          this.current_state = state;
          this.$el.attr('class', state);
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
                }).fail(function (err) { console.log(err)});
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
          var meta, created, updated, title;
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

          title = model.get('title');
          if (title.length > 30) {
            title = title.substring(0, 30) + " ... ";
          };

          return {
            title : title,
            summary : model.get('description'),
            meta : meta
          };
        }
      });

      // TODO: this is deprecated, remove it.
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
        template : '<div class="row"><div class="body">{{#thumbnails}} <a href="{{src}}"><img src="{{thumbsrc}}"/></a>{{/thumbnails}}</div></div></div>' ,

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

      this.GistView = Backbone.View.extend({
        template :  templates['gist']['default_state'],

        preprocess : function(model) {
          var meta = [], body = "";
          /*var created = model.get('created');
          var updated = model.get('updated');
          meta.push({name : 'link', value: "<span> <a href='"+model.get('html_url')+"'>View at Github</a></span>"});
          meta.push({name : 'created', value: "<i class='foundicon-clock'></i><span> " +created.day + " / " + created.month + " / " + created.year + "</span>" });
          meta.push({name : 'updated', value: "<i class='foundicon-edit'></i> <span> " +updated.day + " / " + updated.month + " / " + updated.year  +"</span>"});
          */

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
                if (hljs && hljs.highlight) {
                  // @todo: check if file.language is supported
                  body += "<pre><code>"+hljs.highlight(file.language.toLowerCase(), file.content).value+"</code></pre>";
                } else {
                  body += "<pre><code>" + file.content + "</code></pre>";
                }
                break;
            }
          });

          return {
            title : model.get('title'),
            gist : body,
            meta : meta,
            url: model.get('html_url')
          };
        },

        render: function () {
          var context = this.preprocess(this.model);
          $(this.el).html(this.template(context));
          return this;
        }
      });

      this.BlogView = Backbone.View.extend({
        template : templates.blog.default_state,

        initialize : function () {
          var that = this;        
        },

        render : function () {
          var context = this.preprocess(this.model);
          // replace the html of the element
          $(this.el).html(this.template(context));
          //this.$('.body a').colorbox({rel: 'thumbnails'});
          // return an instance of the view
          return this;
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

      //this.ScrollPagerMixin.call(this.BlogView.prototype);

      this.HeaderView = Backbone.View.extend({
        el: $('#header'),

        template : templates.header.default_state,

        render : function () {
          var context = this.preprocess(this.model);
          // replace the html of the element
          $(this.el).html(this.template(context));
          //this.$('.body a').colorbox({rel: 'thumbnails'});
          // return an instance of the view
          return this;
        },

        preprocess : function(model) {
          var meta = [], context = {};
          var created = model.get('created');
          var description = model.get('description');

          if (description) {
            context.description = description;
          }

          if (created) {
            context.created ="<span class='created'> " +created.day + "  /  " + created.month + "  /  " + created.year + "</span>";
          }

          context.title = model.get('title');
          return context;
        },
      });


      this.InstaPaperView = Backbone.View.extend({
        //template :  '<div class="row instapaper"><div class="three columns"></div><div class="nine columns"><h4><a href="{{url}}"><i class="foundicon-star"></i> {{url_shortened}}</a></h4><p>{{title}} </p><p>{{{summary}}}</p></div></div>',
        template: templates.instapaper.default_state,

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

        render : function () {
          var context = this.preprocess(this.model);
          // replace the html of the element
          $(this.el).html(this.template(context));
          //this.$('.body a').colorbox({rel: 'thumbnails'});
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
            content: model.get('content'),
            summary :  model.get('description'),
            url : model.get('url'),
            url_shortened : url_shortened,
            created : created_str,
          };
          },
        });


        this.PageView = Backbone.View.extend({
          template : templates.page.default_state,

          initialize : function(){
            this.model.bind('destroy', this.remove, this);
          },

          remove : function(){
            this.$el.remove();
          },

          render: function () {
            var context = this.preprocess(this.model);
            $(this.el).html(this.template(context));
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

      this.MainView = this.StateView.extend({
        el: $('#main'),

        template: templates['main'],  

        initialize : function () {
          this.states.push('loading');
          this.states.push('open');
          this.states.push('error');

          this.setTransition('*', 'loading', function () {
            var deferred = Q.defer();
            this.$el.fadeOut({
              duration: 500,
              complete: function () {
                deferred.resolve('empty');
              }
            });
            return deferred.promise;
          });
          
          this.setTransition('loading', '*', function () {
            return Q.fulfill(this);
            var deferred = Q.defer();
            this.$el.fadeIn({
              duration: 500,
              complete: function () {
                deferred.resolve('empty');
              }
            });
            return deferred.promise;
          });
        },
        render : function () {
         var html;
          if (this.getCurrentState() == 'open') {
            this.view = this.factory.getView(this.model);
            html = this.view.render().el;
          } else {
            html = this.template[this.getCurrentState()]({});
          }

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

          this.$el.mousewheel(function (event, d, dX, dY) {
            if (dY < 0) {
              that.nextPage();
            } else if (dY > 0) {
              that.prevPage();
            }
          });


          this.items.bind('remove', function (model) {
            _.each(that.views, function (v) {
              if (v.model === model) {
                v.doTransition('end').then(function () {
                  that.trigger('item:removed');
                });
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

          var pager = new Views.PagerView({view: this});

          $('.item-pager').html(pager.render(0));
          //this.$el.parent().after(pager.render(0));

          this.bind('change:total', pager.render, pager);

          var prev_total = this.getTotal();
          this.bind('item:added item:removed', function () {
            var total = this.getTotal();
            if (total != prev_total) {
              prev_total = total; 
              this.seekToPage(0);
              this.trigger('change:total');
            }
          });
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
          view.bind('state:end', function (promise, prev_state) {
            // When a view is destroyed we have to remove it from the array.
            promise.then(function () {
              that.views = _.filter(that.views, function (it) {
                return it.cid != view.cid;
              });
            }).done();

            /*
            promise.fin(function () {
              if (that.views.length == 0) {
                that.doTransition('empty');
              } else if (that.views.length == 1) {
                that.views[0].doTransition('open');
              }
            });*/
          });

          view.bind('state:open', function (promise, prev_state) {
            promise.then(function () {
              view.render();
            }).done();

            var promises = [];
            // Ensure all other itemviews are closed.
            _.each(that.views, function (v) {
              var p = v.getPromisedState().then(function (state) {
                if (state == 'open' && v !== view) {
                  return v.doTransition('closed', true);
                }
                return Q.fulfill(state);
              }).done();
              promises.push(p);
            });

            promises.push(promise);

            if (promises.length !=0) {
              Q.all(promises).then(function () {
                return that.doTransition('open');
              }).done();
            } else {
              that.doTransition('open').done();;
            }

            // TODO: if promise failed, revert state change. <-- should be done,
            // by itemviews.
            
          }, view);

          view.bind('state:closed', function (promise, prev_state) {
            promise.then(function (view) {
              view.render();
            }).done();

            that.doTransition('closed').done();
            /*that.getPromisedState().then(function (state) {
              if (state == 'open'){
                that.doTransition('closed');
              }
            });*/
          });
        },

        addItem : function (item) {
          var view, html, idx, children,that = this;
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

          $(view.el).slideDown(400, function () {
            that.trigger('item:added');
          });

          if (this.getCurrentState() == 'empty') {
            this.doTransition('closed');
          }
        }
      });

      this.StateMixin.call(this.ItemListView.prototype);
      this.ScrollPagerMixin.call(this.ItemListView.prototype);

   }
    return new module();
  }
);
