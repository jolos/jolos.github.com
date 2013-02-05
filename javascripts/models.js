/*jslint indent: 2, browser: true */
/*global define, jQuery, $*/
define('models', ['backbone', 'underscore', 'q'],
  function (Backbone, _, Q) {
    'use strict';
    var module = function () {
      /**
       * Abstract Item, should not be instantiated directly. 
       * TODO: could be a mixin.
       */
      this.Item = Backbone.Model.extend({
        // Default parse method
        parse: function (response) {
          return response;
        },
        // override this to provide your own params for the ajax call
        getParams: function () {
          return {
            url: this.url(),
            dataType: 'json'
          };
        },
        // Override default fetch method, because the original's success callback doesn't
        // return anything. ( which doesn't play well with promises ).
        // IMHO, fetch should take any arguments, you can do almost everything with
        // promises.
        fetch: function (options) {
          // Our sync is currently the same as a fetch.
          return this.sync();
        },
        // TODO: find out, why this isn't available in the prototype.
        sync: function () {
          // At the moment we don't need all the extra things Backbone.sync does
          var that = this;
          // TODO: we should handle different dataTypes
          return Q.when(jQuery.ajax(this.getParams()))
            .then(function (item) {
               // update the model and return it.
              return that.set(that.parse(item));
            });
        }
      });

      this.Gist = this.Item.extend({
        defaults: {
          type: 'gist'
        },
        getParams: function () {
          return {
            url: 'https://api.github.com/gists/' + this.get('id'),
            dataType: 'jsonp'
          };
        },
        parse : function (response) {
          return {'files' : response.data.files};
        }
      });

      this.BlogItem = this.Item.extend({
        defaults : {
          content : "",
          type: 'blog'
        },
        getParams: function () {
          return {
            url: './blogs/' + this.get('id'),
            dataType: 'text'
          };
        },
        parse : function (response) {
          return {'content' : response};
        }
      });

      this.InstaPaper = this.Item.extend({
        defaults: {
          type: 'instapaper'
        }
      });

      this.Page = this.Item.extend({
        defaults : {
          type: 'page',
          content : ""
        },
        getParams: function () {
          return {
            url: "/" + this.get('path'),
            dataType: 'html'
          };
        },
        parse : function (response) {
          return {'content' : response};
        }
      });

      this.Album = this.Item.extend({
        defaults: {
          type: 'album'
        },
        getParams: function () {
          return {
            url: 'https://picasaweb.google.com/data/feed/api/user/' + "103884336232903331378" + '/albumid/' + this.get('id') + '?alt=json&imgmax=800',
            dataType: 'jsonp'
          }
        },
        parse: function (data) {
          var photos, that, files;
          photos = data.feed.entry;
          that = this;
          files = [];

          _.each(photos, function (item, i) {
            files.push({
              src: item.content.src,
              thumbsrc: item.content.src.replace('s800', 's160-c')
            });
          });

          return {
            thumbnails: files
          };
        }
      });
    }
    var mod = new module();
    return mod;
});
