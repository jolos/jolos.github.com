define('models',['backbone', 'underscore', 'q'],
  function(Backbone, _, Q) {
    var module = function() {
  /**
   * Abstract Item, should not be instantiated directly. 
   * TODO: could be a mixin.
   */
  this.Item = Backbone.Model.extend({
    // Default parse method
    parse: function(response){
      return response;
    },
    // override this to provide your own params for the ajax call
    getParams: function(){
      return {
        url: this.url(),
        dataType: 'json',
      };
    },
    // Override default fetch method, because the original's success callback doesn't
    // return anything. ( which doesn't play well with promises ).
    // IMHO, fetch should take any arguments, you can do almost everything with
    // promises.
    fetch: function(options) {
      // Our sync is currently the same as a fetch.
      return this.sync();
    },
    // TODO: find out, why this isn't available in the prototype.
    sync: function() {
      // At the moment we don't need all the extra things Backbone.sync does
      var that = this;
      // TODO: we should handle different dataTypes
      return Q.when(jQuery.ajax(this.getParams()))
        .then(function(item){
           // update the model and return it.
           return that.set(that.parse(item));
         });
    },
  });

  this.Gist = this.Item.extend({
    sync: function(method,model,options){
      var url =  'https://api.github.com/gists/' + model.get('id');
      jQuery.ajax({
        url : url,
        dataType : 'jsonp',
        context : this,
        success : function(json){
          try {
            this.set('files',json.data.files);
            options.success.call(options.context);
          } catch(err) {
            error_log('sync','failed parsing Gist: '+err.get_message());
          }
        },
        error : function(data){
          console.log(data);
          error_log('sync', 'Error while trying to sync blog with ' + url);
        },
      });

    },
  });

  this.BlogItem = this.Item.extend({
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
          try{
            this.set('content',data);
            options.success.call(options.context);
          } catch(err) {
            error_log('sync','failed parsing Blog: '+err.get_message());
          }
        },
        error : function(data){
          error_log('sync', 'Error while trying to sync blog with ' + url);
        },
      });
    },
  });

  this.InstaPaper = this.Item.extend({
    // Empty :-)
  });

  this.Page = this.Item.extend({
    defaults : {
      content : "",
    },
    getParams: function(){
      return {
        url: "/" + this.get('path'),
        dataType: 'html',
      };
    },
    parse : function(response){
      return {'content' : response};
    },
  });

  this.Album = this.Item.extend({
    getParams: function() {
      return {
        url: 'https://picasaweb.google.com/data/feed/api/user/' + "103884336232903331378" + '/albumid/' + this.get('id') +'?alt=json&imgmax=800',
        dataType: 'jsonp',
      }
    },
    parse: function(data){
      photos = data.feed.entry;
      var that = this;
      var files = [];
      _.each(photos,function(item,i){
           files.push({src: item.content.src, thumbsrc: item.content.src.replace('s800','s160-c')});
      });
      return {thumbnails:files};
    },
   });
   }
   var mod = new module();
   return mod;
});
