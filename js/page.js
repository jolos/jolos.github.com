  window.Page = Backbone.Model.extend({
    url : function() {
      return 'pages/' + this.get('route') + ".html";
    },

    parse: function(response){
      this.set('page',response);
    },
    sync: function(method,model,options){
      $.ajax({
        url : this.url(),
        dataType : 'html',
        success : options.success,
        error : options.error,
      });
    },
  });

  var PageView = ItemView.extend({
    template : "<div class='page'>{{{page}}}</div>",

    preprocess: function(model){
      return {
        page: model.get('page')
      };
    },
  });

