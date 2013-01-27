define('models',['backbone', 'underscore', 'q'],
  function(Backbone, _, Q) {
    var module = function() {
  /**
   * Abstract Item, should not be instanced directly
   */
  this.Item = Backbone.Model.extend({
    // Override default fetch method, because the original's success callback doesn't
    // return anything. ( which doesn't play well with promises )
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var success = options.success;
      options.success = function(model, resp, options) {
        if (!model.set(model.parse(resp, options), options)){
          return false;
        }
        if (success) success(model, resp, options);
        return model;
      };
      return this.sync('read', this, options);
    },
    // TODO: find out, why this isn't available in the prototype.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
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
  });

  this.Page = this.Item.extend({
    defaults : {
      content : "",
    },

    url : function(){
      return  "/" + this.get('path');
    },

    parse : function(response){
      return {'content' : response};
    },
  });

  this.Album = this.Item.extend({
    sync: function(method,model,options){
      var id = model.get('id');
      var uid = "103884336232903331378";
      var url = 'https://picasaweb.google.com/data/feed/api/user/' + uid + '/albumid/' + id +'?alt=json&imgmax=800';

     jQuery.ajax({
        url : url,
        dataType : 'jsonp',
        context : this,
        success : function(data){
         try {
           photos = data.feed.entry;
           var that = this;
           var files = [];
           _.each(photos,function(item,i){
             files.push({src: item.content.src, thumbsrc: item.content.src.replace('s800','s160-c')});
           });
           this.set('thumbnails',files);
           options.success.call(options.context);
         } catch(err) {
           error_log('sync','failed parsing Album: '+err.get_message());
         }
        },
        error : function(data){
          error_log('sync', 'Error while trying to sync album with albumid ' + id);
        },
      });
    },
  });
   }
   var mod = new module();
   return mod;
});
