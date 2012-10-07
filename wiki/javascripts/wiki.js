$(function() {

    /**
     * Errors
     **/
    window.Error = Backbone.Model.extend({
      defaults : function(){
        return {
          msg : "Something went wrong",
        };
      },
    });

    window.NoRouteError = Error.extend({
      defaults : function(){
        return {
          msg : "Couldn't find route to path",
          path: "path",
          parent: window.master,
        };
      },
    });

    window.ErrorView = Backbone.View.extend({
      template : "<div class='alert-box alert'>{{msg}}<a class='close' href=''>x</a></div>",

      render : function(){
        var data = {
          'msg' : this.model.get('msg'),
        }

        html = Mustache.render(this.template,data);
        $(this.el).html(html);
        return this;
      },

      clean : function(){
        $(this.el).empty();
      },
    });

    /**
     * Views
     **/
    window.ViewFactory = function() {
    };

    _.extend(ViewFactory.prototype,{
      views : [],

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

    /**
     * View for visualising Directories
     **/
    window.DirView = Backbone.View.extend({
      tagName : "table",

      template: "<thead><tr><th>Name</th><th>Type</th></thead><tbody>{{#rows}}<tr><td><a href='#{{path}}'>{{name}}</a></td><td>{{type}}</td></tr>{{/rows}}</tbody>",

      render : function(){
        var data = {
            'rows' : [],
        };
        $.each(this.model.get('children'),function(i,child){
          data['rows'].push({
            'name' : child.get('value').name,
            'type' : child.get('value').type,
            'path' : child.get('value').path,
          });
        });

        html = Mustache.render(this.template,data);
        $(this.el).html(html);
        return this;
      },
    });

    /**
     * View for visualising (markdown) Files
     **/
    window.FileView = Backbone.View.extend({
      tagName : "div",

      template : "<a class='small secondary button' href='http://prose.io/#{{user}}/{{repo}}/edit/{{branch}}/{{path}}'>Edit with prose.io</a> {{{body}}}",

      render : function(){
        var file = this.model.get("value");
        var raw = file.getRawContent();
        // TODO : add pluggable file handlers
        body = marked(raw);
        var data = {
          "body" : body,
          "user" : file.user.login,
          "repo" : file.repositoryName,
          "branch" : file.branchName,
          "path" : file.path,
        };

        var html = Mustache.render(this.template,data);
        $(this.el).html(html);
      
        return this;
      },
    });

    /**
     * View for visualising a Breadcrumb
     **/
    window.BreadCrumbNodeView = Backbone.View.extend({
      tagName: "li",

      template: "<a href='#{{path}}'>{{name}}</a>",

      render : function() {
        var data = {
          'name' : this.model.get('value').name,
          'path' : this.model.get('value').path,
        };
        
        var html = Mustache.render(this.template, data);
        $(this.el).html(html);
        return this;
      },
    });

    /**
     * View for visualising a list of Breadcrumbs
     **/
    window.BreadCrumbView = Backbone.View.extend({
      el: $('ul.breadcrumbs'),

      initialize : function() {
        this.nodes = new NodeList;
        this.nodes.bind("add", this.addNode,this);
        this.nodes.bind("reset",this.clean,this);
      },

      addNode : function(node){
        var view = new BreadCrumbNodeView({ model: node}); 
        var html = view.render().el;
        $(this.el).prepend(html);
      },

      clean : function(){
        $(this.el).empty();
      },

      render : function() {
        var that = this;
        this.nodes.each(function(node){
          that.addNode(node);
        });
        return this;
      },
    });

    /**
     * Router ( connects all the pieces together )
     **/
    window.Router = Backbone.Router.extend({

      routes: {
        "*actions" : "default",
      },

      initialize : function(){
        this.factory = new ViewFactory();
        this.factory.register(DirNode,DirView);
        this.factory.register(FileNode,FileView);
        this.factory.register(Error,ErrorView);
      },

      default : function(actions){
        // This function connects all the parts
        var path = _.filter(actions.split("/"),function(str){ return str });
        path.unshift('master');
        var that = this;
        this.tree.navigate(path,{
          success: function(node) {
            window.breadcrumbs.nodes.setTail(node);
            var value = node.get('value');
            var view = that.factory.getView(node);
            $('#main').html(view.render().el);
          },
          error: function(error){
            if( error instanceof NoRouteError){
                var parent = error.get('parent');
                window.breadcrumbs.nodes.setTail(parent);
                var view = that.factory.getView(parent);
                var errorview = that.factory.getView(error);
                $('#main').html(view.render().el);
                $('#main').prepend(errorview.render().el);
            }
            console.log(error);
          },
        });
      },
    });

    /**
     * Models
     **/
    window.Node = Backbone.Model.extend({
      defaults : function() {
        return {
          parent  : undefined,
          children: [],
          value   : "",
          fetched : false,
        };
      },

      getChildren: function(success,args) {
          throw new Error({msg: "No instances of Node should be created"});
      },

      navigate : function(path,callback) {
        var value = this.get('value');
        var children = this.get('children');
        if(this.get('fetched')){
         // we have already fetched the children before
           path.shift();
           if(path.length == 0){
             callback.success(this);
             //result.getChildren(callback.success,[result]);
           } else {
             // we didn't reach the end of the path yet
             var result = _.find(children,function(child) {
               return child.get('value').name == path[0];
             });

            if(result){
               result.navigate(path,callback);
            } else {
               callback.error(new NoRouteError({path: path, parent: this}));
            }
           }
        } else {
          // children have not been fetched
          this.getChildren(this.navigate,[path,callback]);
        }
      },
    });

    window.DirNode = Node.extend({

      getChildren: function(success,args) {
          var that = this;
          var value = this.get('value');
          value.fetchContents( function(err,res){
            value.eachContent( function(content){
              if ( content.type == 'file') {
                that.get('children').push(new FileNode({parent: that,value: content}));
              } else {
                that.get('children').push(new DirNode({parent: that,value: content}));
              }
            });
            // fetching children finished, we call method again on this node
            that.set('fetched',true);
            success.apply(that,args);
          });
      },

    });

    window.FileNode = Node.extend({

      getChildren: function(success,args) {
          var that = this;
          var value = this.get('value');
          console.log("fetching children of: " + this.get('value').name);
          // TODO : do this with overriding
          value.fetchContent(function (err, res) {
              if(err) { throw new Error({msg: "smth went wrong while fetching contents"}) };
              that.set('fetched',true);
              success.apply(that,args);
          });
      }
   
    });

    window.NodeList = Backbone.Collection.extend({
      item: Node,

      setTail : function(tail){
        this.reset();
        do {
          this.add(tail);
        } while(tail = tail.get('parent'));
      },
    });

     //initialize everything
    window.breadcrumbs = new BreadCrumbView();

    window.github_user = "jolos";
    window.github_repo = "wiki";
    var user = new Gh3.User(window.github_user)
    var repo = new Gh3.Repository(window.github_repo, user);
    var items = this.items;
    repo.fetch(function (err,res) {
      repo.fetchBranches( function(err,res) {
        window.master = repo.getBranchByName("master");
        window.router = new Router;
        // point the router to the master directory 
        window.router.tree = new DirNode({value: window.master});
        Backbone.history.start();
      });
    });
});
