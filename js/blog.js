$(function(){

	window.Error = function(message,description){
		var data = {
			message : message,
			description : description,
		};

		error = ich.alert(data);
		$("#errors").append(error);
	};

	var Router = Backbone.Router.extend({
		routes: {
	    		"blog/:id":	"blog",
			"*actions": 		"default",
		},

	    	initialize : function(options){
			this.pages = new Array();
			$.ajax({
				url : 'json/pages.json',
				dataType : 'json',
				success : this.addPages,
				error : function(data){
					Error('Oops','Something went wrong, not everything will work as it should');
				},
			});
		},


	    	// callback to add routes for all pages
	    	addPages : function(data){
			$.each(data,function(i,item){
				// TODO : ugly
				app_router.route(item.route,item.route,app_router.pageHandler);
			});
			Backbone.history.start();
		},

		// handler to render pages
		pageHandler : function(actions){
			// this is a bit hackish, but seems to be the only way to get the current route
			var route= window.document.location.hash;
			this.renderPage(route.substring(1));
		},

	    	default: function(actions){
			// TODO cleaning should be done with proper events
			$('#header').empty();
			$('#items').empty();
			if( $.inArray(actions,this.pages) != -1) {
				// deprecated
				this.renderPage(actions);
			} else if(!(window.App instanceof AppView)){
				// this means we either don't have a AppView yet or that it has been replaced by another View objec
				// i.e. a PageView
				window.App = new AppView;
				if( actions != ""){
					Error(""+actions+" doesn't exist!","You're trying to visit a page that doesn't exist, redirecting you to home");
				}
			} else {
				window.App.refresh();
			}
		},

		// TODO : rendering shouldn't happen here, and should use a view
		renderPage : function(route){
			// get page by ahah
			$('#header').empty();
			$('#items').empty();
			$.ajax({
				url : 'pages/' + route + ".html",
				dataType : 'html',
				success : function(html){
					// replace html
					$("#items").html(html);
				},
				error : function(html){
					// output error
					Error("Error occured","");
				},
			});
		},

	    	blog: function(id){
			window.App.removeAll();
			// get the corresponding model
			item = Items.get(id)
			// create view
			view = new BlogView({ model : item});
			// place the generated html on the page
			$("#items").html(view.render().el);
		},


	});


	// little view/model factory 
	var types = {
		'blog' : { 
			view : function(item){
				return new BlogView({ model :item});
			},
			model : function(attributes){
				return new Blog(attributes);
			},
		},
		'item' : {
			view : function(item) {
				return new ItemView({ model : item });
			},
			model : function(attributes){
				return new Item(attributes);
			}
		},
	}


	// Abstract Item, in most cases we want to override this
	window.Item = Backbone.Model.extend({
		url : function(){
			return 'json/item/' + this.get('id') + ".json";
		},

		defaults : function(){
			return {
				folded : true,
				synced : false,
			};
		},

		// parse should only get called on a update, so we use extend 
		// normally this won't be called as you want to override this
		parse : function(response){
			return _.extend(this.attributes,response.items);
		},
	});

	window.Blog = Backbone.Model.extend({
		// the blog model uses a different service endpoint
		url : function(){ 
			return 'json/item/' + this.get('id') + ".json";
	       	},

		defaults: function(){
			return {
				body : "",
				folded : true,
				synced : false,
			};
		},

		// this will get called when we do a fetch on the model, or if ItemList.parse doesn't return proper model objects
		parse : function(response){
			 // the json format doesn't allow for line endings, we work around this by
			 // providing a list of strings
			 response.body = response.body.join('<br/>');
			 return _.extend(this.attributes,response);
		},
	});

	window.ItemList = Backbone.Collection.extend({
		// the model is the Abstract Item model
		model : Item,
		// a HTTP GET to the following url, will return all items, serialized as JSON
		url : 'json/items.json',

		parse : function(response){
			var items = new Array();
			$.each(response,function(i,item){
				items.push(types[this.type].model(item));
			});
			return items;
		},
	});


	window.Items = new ItemList;

	// Abstract ItemView, in most cases we want to override this 
	var ItemView = function(options){
		Backbone.View.apply(this,[options]);
	}

	_.extend(ItemView.prototype, Backbone.View.prototype,{
		tagName : "div",


		initialize : function(){
			this.model.bind('change', this.render, this);
			this.model.bind('destroy', this.remove, this);
		},

		render : function(){
			data =this.preprocess(this.model)
			// use ICanHaz.js to render
			html = ich[this.model.get('type')](data);
			// replace the html of the element
			$(this.el).html(html);
			// we have to bind all the Links
			bindLinks($(this.el));
			// return an instance of the view
			return this;
		},

		preprocess : function(model){
			return {
				header : model.get('header'),
				created : model.get('created'),
				updated : model.get('updated'),
				author : model.get('author'),
				tags : model.get('tags'),
			};
		},
	});

	ItemView.extend = Backbone.View.extend;


	window.BlogView = ItemView.extend({
		// define the blog specific events
		events : {
			"click h1" 	: "toggleFold",
			"click i.icon-chevron-up" : "toggleFold",
			"click div.tags span" : "filterOnTag",
		},

		// override initialize function
		initialize : function(){
			// when the model has been synced we want to rerender and then fold
			this.model.bind('change:synced',function(){ this.render(); this.fold(); }, this);
			this.model.bind('destroy', this.remove, this);
			this.folded = true
		},

		// function to animate fold
		fold : function(){
			this.$('div.body').slideToggle('slow');
			this.folded = !this.folded;
		},

		filterOnTag : function(ctx){
			// get tag ( there might be a better way to do this )
			var tag = ctx.target.textContent;
			window.App.filter = function(model){
				tags = model.get('tags');
				return !($.inArray(tag,tags) == -1);
			};	

			window.App.refresh();
		},


		toggleFold : function() {
			if(!this.model.get('synced')){
				// only do a fetch if we haven't synced before
				this.model.fetch({
					success: function(model,response){
						model.set({'synced' : true});
					},
					error : function(model,response){
						Error('Error!', "We couldn't retrieve the content of the blog you where trying to read");
					},
				});
			} else {
				// if we already did a fetch before, don't do a second one
				this.fold();
			}
		},

		preprocess : function(model){
			var tags =[];
			$.each(model.get('tags'),function(i,tag){
				tags.push({'tag':tag}); 
			});

			var created_date = new Date(model.get('created').split(' ')[0]);

			return {
				header : model.get('header'),
				created_year : created_date.getFullYear(),
				created_month : created_date.getMonth(),
				created_day : created_date.getDate(),
				updated : model.get('updated'),
				author : model.get('author'),
				body : model.get('body'),
				tags : tags,
			};
		},
		
	});

	window.AppView = Backbone.View.extend({
		el: $('div.container'),

		filter : function(model){ return true;},

		initialize : function() {
			Items.bind('reset', this.render, this);
			Items.fetch();
		},


		addItem : function(i,item){
			// Depending on what kind of item, we want a different view here
			if( types[item.get('type')] ) {
				var view = types[item.get('type')].view(item);
			}
			else {
				// default
				var view = new ItemView({ model : item });
			}

			$("#items").append(view.render().el);
		},


		addAll : function(){
			items = Items.filter(this.filter);
			$.each(items,this.addItem);
		},

	        clean : function(){
			$("#items").empty();
		},

		refresh : function(){
			this.clean();
			this.render();
		},

		render: function(){
			// render header
			hero = ich.hero(header_data);
			$("#header").html(hero);
			// we have to rebind the links as this is brand new html
			bindLinks($("#header"));
			this.addAll();
			},
	});


	var app_router = new Router;

	app_router.on('route',function(page){
		$("#errors").empty();

	});

	var bindLinks = function(el){
		// rebind clicks
		el.find('a').click(function(){
			if( this.hash.startsWith('#')){
				var route = this.hash.substring(1);
				app_router.navigate(route,{trigger : true});
				$("#errors").empty();
			}
		});
	};

	bindLinks($('body'));

});

if (typeof String.prototype.startsWith != 'function') {
	  String.prototype.startsWith = function (str){
		      return this.indexOf(str) == 0;
		        };
}

// helper function to capitialize a string
String.prototype.capitalize = function() {
	    return this.charAt(0).toUpperCase() + this.slice(1);
}
