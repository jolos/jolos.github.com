$(function() {

    window.Item = Backbone.Model.extend({
      defaults : function(){
        return {
          name : "",
          size : "",
          path : "",
          type : "file",
        };
      }
    });

    window.ItemView = Backbone.View.extend({
      tagName : "dd",

      events : {
       'click a' : 'onClick',
      },

      onClick : function(ctx) {
        if(this.model.get('type') == "dir"){
          window.lst.setDir(this.model.get("item"));
        } else {
          window.page.setModel(this.model);
        }
      },

      template : {
        file: "<a href='#'>{{name}}</a>",
        dir: "<a href='#'>{{name}}</a>",
      },

      render : function(){
        var type = this.model.get('type');
        var data = this.preprocess(this.model);
        html = Mustache.render(this.template[type],data);
        $(this.el).html(html);
        return this;
      },

      preprocess : function(model){
        return {
          'name' : model.get('name'),
          'path' : model.get('path'),
        };
      },
    });

    window.FileView = Backbone.View.extend({
      tagName : "div",

      template : "<a class='small secondary button' href='http://prose.io/#{{user}}/{{repo}}/edit/{{branch}}/{{path}}'>Edit with prose.io</a> {{{body}}}",

      setModel : function(model){
        this.model = model;
        var file = model.get("item");
        var body = "";
        var that = this;
        file.fetchContent(function (err, res) {
                  if(err) { throw "outch ..." }
                  var raw = file.getRawContent();
                  // TODO : add pluggable file handlers
                  body = marked(raw);
                  that.render({
                    "body" : body,
                    "user" : file.user.login,
                    "repo" : file.repositoryName,
                    "branch" : file.branchName,
                    "path" : file.path,
                  });
        });
      },

      render : function(data){
        if (this.model) {
          var html = Mustache.render(this.template,data);
          console.log(html);
          $(this.el).html(html);
        } else {
          $(this.el).html("");
        }
        return this;
      },

      preprocess : function(model){
        // TODO fetch content
             },
    });

    window.ItemList = Backbone.Collection.extend({
      model: Item,
    });

    window.ItemListView = Backbone.View.extend({
      el: $('dl'),

      initialize : function() {
        this.items = new ItemList;
        this.items.bind("add",this.addItem);
        //TODO add bindings
        //TODO 
        var items = this.items;
        this.items.currentDir = window.master;
        master.fetchContents(function(err,res) {
          master.eachContent(function (content) {
            var item = new Item({
              "name" : content.name,
              "type" : content.type,
              "path" : content.path,
              "item" : content,
            });
            items.push(item);
          });
        });   
      },

      addItem : function(item){
        // render the item  and add
        var view = new ItemView({ model : item });
        html = view.render().el;
        $("#tree").append(html);
      },

      setDir: function(dir){
        //this.items.unbind();
        //this.items = list;
        //this.items.bind("add",this.addItem);
        // TODO for now we do a reset & fetch everytime
        // but we should use a proper tree here, for caching
        this.items.reset();
        $('#tree').empty();
        var parentdir = this.items.currentDir;
        this.items.currentDir = dir;
        this.items.push(new Item({
          "name" : "..",
          "type" : "dir",
          "path" : parentdir.path,
          "item" : parentdir,
        }));
        var items = this.items;
        dir.fetchContents( function(err,res){
          dir.eachContent( function(content){
            var item = new Item({
              "name" : content.name,
              "type" : content.type,
              "path" : content.path,
              "item" : content,
            });
            items.push(item);
          });
        });
      },
    });

    window.github_user = "jolos";
    window.github_repo = "wiki";
    var user = new Gh3.User(window.github_user)
    var repo = new Gh3.Repository(window.github_repo, user);
    var items = this.items;
    repo.fetch(function (err,res) {
      repo.fetchBranches( function(err,res) {
        window.master = repo.getBranchByName("master");
        window.lst = new ItemListView;
        window.page = new FileView(new Item({}));
        $('#main').html(window.page.render({"body" : "hello"}).el);
      });
    });

    

});


