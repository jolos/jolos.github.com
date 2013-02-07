/*jslint indent: 2, browser: true */
/*global define, jQuery, require,$*/
define('main', ['backbone', 'underscore', 'q'],
  function (Backbone, _, Q) {
    'use strict';
    window.error_log = function (type, msg) {
      console.log(msg); 
      _gaq.push(['_trackEvent', 'error', type, msg]);
    };

    var module = function () {
      var App = this;
      App.Router = Backbone.Router.extend({

        routes: {
          "*actions" : "default"
        },
      
        aliases : {
          '' : 'type/!page&!gist&!instapaper/title/!elastic&!profiel&!plakboek&!test&!notes',
          'all' : '/',
          'albums' : 'type/album/title/!plakboek&!profiel',
          'instapaper' : 'type/instapaper',
          'blogs' : 'type/blog',
          'about/me' : 'type/page/path/about.me'
        },

        initialize : function () {
          this.bind('route:default', function (route) {
            window.document.title = " シ " + route;
          });
          this.bind('route:default', function (route) {
              _gaq.push(['_trackPageview', "/#" + route]);
          });
          //this.bind('route:default', draw);
          this.fetchers = [];

          this.items = new App.ItemList;

          var that = this;

          // TODO: provide fetchers as an argument of main.
          require(['fetchers'], function (Fetchers) {
            that.fetchers.push(new Fetchers.GistFetcher('jolos'));
            that.fetchers.push(new Fetchers.PicasaFetcher("103884336232903331378"));
            that.fetchers.push(new Fetchers.BlogFetcher('json', './blogs.json'));
            that.fetchers.push(new Fetchers.PageFetcher('jolos', 'jolos.github.com', 'pages'));
            that.fetchers.push(new Fetchers.InstaPaperFetcher('http://www.instapaper.com/starred/rss/2609795/rU9MxwxnbvWbQs3kHyhdoLkeGbU'));
            Backbone.history.start();
          });

          require(['views', 'models'], function (Views, Models) {
            var factory = new Views.ViewFactory;
            factory.register(Models.Gist, Views.GistView);
            factory.register(Models.Album, Views.AlbumView);
            factory.register(Models.BlogItem, Views.BlogView);
            factory.register(Models.Page, Views.PageView);
            factory.register(Models.InstaPaper, Views.InstaPaperView);
            // Get an instance of the main view, inject the dependencies.
            that.appview = new Views.ItemListView({items: that.items, factory: factory});
            that.bind('route:default', that.items.clean, that.items);
            that.items.filteredItems.bind('add', that.appview.addItem, that.appview);
            // render the items.
            that.items.filteredItems.each(that.appview.addItem, that.appview);

          });
        },

        fetch: function (typefilter) {
          var promises, itemlist, additem;
          promises = [];
          itemlist = this.items;

          _.each(_.filter(this.fetchers, typefilter.filter), function (fetcher) {
            if (!fetcher.fetched) {
              var promise = fetcher.fetch();
              fetcher.fetched = true;
              promise.then(function (promiselist) {
                _.each(promiselist, function (promise) {
                  promises.push(promise.then(function (item) {
                    itemlist.add(item);
                    return item;
                  }));
                });
              });
            }
          });
          // TODO: return a Q.all promise.
        },

        default : function (actions) {
          var alias, path, filters, typefilters, filter, typefilter;
          alias = this.aliases[actions];
          

          if (alias) {
            path = _.filter(alias.split("/"), function (str) { return str });
          } else {
            path = _.filter(actions.split("/"), function (str) { return str });
          }
          // This function connects all the parts

          try {
            filters = [];
            typefilters = [];

            while (path.length != 0) {
              var name = path.shift();
              var query = path.shift();
              (function (name, query) {
                //var name = path.shift();
                var parser, filter;
                parser = new App.FilterParser(name);
                filter = parser.parse(query);
                if (name === 'type') {
                  typefilters.push(filter);
                }
                filters.push(filter);
              })(name, query);
            }
            
            if (filters.length > 1) {
              filter = new App.AndFilter(filters);
            } else if (filters.length == 1) {
              filter = filters[0];
            } else {
              filter = new App.TrueFilter();
            }
            
            //filter = new App.TrueFilter();

            this.items.filter = filter;

            if (typefilters.length > 1) {
              //this.appview.items.fetch(new AndFilter(typefilters));
              typefilter = new App.AndFilter(typefilters);
            } else if (typefilters.length == 1) {
              //this.appview.items.fetch(typefilters[0]);
              typefilter = typefilters[0];
            } else {
              typefilter = new App.TrueFilter();
            }

            this.fetch(typefilter);
          } catch (err) {
            error_log('general', err.message);
          }
        }
      });

      App.FilterParser = function (name) {

        this.parse = function (query) {
          var filter = this.parseAnd(query);
          if (filter) {
            return filter;
          }

          filter = this.parseOr(query);

          if (filter) {
            return filter;
          }

          filter = this.parseNot(query);
          
          if (filter) {
            return filter;
          }

          filter = this.parseDefault(query);
          return filter;
        };
          
        this.parseParentheses = function (query) {
          var pos1, pos2;
          pos1 = query.indexOf("(");
          pos2 = query.indexOf(")");
          if ( pos1 == -1  && pos2 != -1){
            throw "invalid query";
          } else if (pos1 != -1) {
            return this.parse(query.substring(pos1, pos2));
          }

          return false;
        };

        this.parseAnd = function (query) {
          if (query.indexOf('&') != -1) {
            var subqueries = query.split('&');
            return new App.AndFilter(_.map(subqueries, this.parse, this));
          }
          return false;
        };

        this.parseOr = function (query) {
          if (query.indexOf('|') != -1) {
            var subqueries = query.split('|');
            return new App.OrFilter(_.map(subqueries, this.parse, this));
          }
          return false;
        };

        this.parseNot = function (query) {
          if (query.indexOf('!') != -1) {
            var subquery = query.substring(1);
            return new App.NotFilter(this.parse(subquery));
          }
          return false;
        };

        this.parseDefault = function (query) {
          if (name == 'type') {
            return new App.TypeFilter(query);
          }
          return new App.PropertyRegexFilter(name, query);
        };
      };

      App.FilterFactory = function (defaultFilter) {
        this.default = defaultFilter;
      };

      _.extend(App.FilterFactory.prototype, {
        filters : [],

        getFilterInstance : function (name, arg) {
          var filter;
          var tuple = _.find(this.filters, function (tuple) {
            return name == tuple.name;
          });

          if (tuple) {
            filter = new tuple.filter(arg);
          } else {
            // return default filter
            filter = new defaultFilter(arg);
          }

          return filter;
        },

        register : function (name, filterobj) {
          var tuple = {
            'name': name, 
            'filter': filterobj
          };

          this.filter.push(tuple);
        }
      });

    App.OrFilter = function (filters) {
      if(filters.length < 2) {
          throw "OR filter needs at least two filters";
      }

      this.filter = function (item) {
        var filter;
        for (var i = 0; i < filters.length; i++){
          filter = filters[i];
          if (filter.filter(item)) {
             return true;
          }
        }
        return false;
      };

      this.tostr = function () {
        return _.reduce(filters, function (memo,filter,idx) { 
          if (idx == 0) return filter.tostr();
          return memo + ' OR ' + filter.tostr();
        },'');
      };
    };

    App.TrueFilter = function () {
      this.filter = function (item) {
        return true;
      };

      this.tostr = function () {
        return "TRUE";
      };
    };

    App.NotFilter = function (filter) {
      this.filter = function (item) {
        return !filter.filter(item);
      };

      this.tostr = function () {
        return "NOT " + filter.tostr();
      };
    };

    App.AndFilter = function (filters) {
      if(filters.length < 2) {
          throw "AND filter needs at least two filters"
      }

      this.filter = function (item) {
        for (var i = 0; i < filters.length; i++) {
          var filter = filters[i];
          if (!filter.filter(item)) {
             return false;
          }
        }
        return true;
      };

      this.tostr = function () {
        return _.reduce(filters, function (memo,filter,idx) { 
          if(idx == 0) return filter.tostr();
          return memo + ' AND ' + filter.tostr();
        },'');
      };
    };

    App.PropertyRegexFilter = function (name,regex) {
      this.pattern = new RegExp(regex,'i');

      this.filter = function (item) {
        return this.pattern.test(item.get(name));
      };

      this.tostr = function () {
        return name + ' == ' + regex;
      };
    };

    App.TypeFilter = function (query) {
      this.filter = function (item) {
        return (item.getType() == query);
      };

      this.tostr = function () {
        switch (query) {
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

    initialize : function () {
      this.bind('add',this.percolate);
      this.filteredItems = new App.FilteredItemList;
    },
    
    fetch : function (type_filter) {
      var that = this;
      _.each(this.fetchers, function (fetcher, i) {
        fetcher.fetch(type_filter, function(item) {
          this.add(item);
        }, that);
      });
    },

    percolateAll : function () {
      this.each(this.percolate, this);
    },

    percolate : function (item) {
      if(this.filter.filter(item)){
        this.filteredItems.add(item.clone());
      }
    },

    clean : function () {
      var that = this;
      var notfilter = new App.NotFilter(this.filter);
      var dirty_items = this.filteredItems.filter(notfilter.filter);
      _.map(dirty_items, function (item) {
        item.destroy();
      });
      this.percolateAll();
    }
   });

   App.FilteredItemList = Backbone.Collection.extend({
      comparator : function (item) {
        var created = item.get('created');
        if (created) {
          // use ints for fast comparison
          var nmbr = created.day + created.month * 100 + created.year*10000;
          return -nmbr;
        }
        return 0;
      }
   });
  };
  return new module();
});
