define('fetchers', ['q', 'underscore', 'models'],
  function(Q, _, Models){
    var module = function() {
      this.AbstractFetcher = function() {
      };

      _.extend(
        this.AbstractFetcher.prototype,
        {
          // Parse should always return a promise.
          // You almost always want to override this.
          parse : function(data) {
            return Q.fulfill(data);
          },
          // You probably want to override the parameters.
          getParams : function(){
            return {
              url : this.url,
              dataType : this.dataType,
            };
          },
          // By default we're using jQuery for ajax calls.
          request : function(params) {
            return jQuery.ajax(params);
          },
          // Fetch should always return an array of promises.
          // You probably don't want to override this.
          fetch : function() {
            var that = this;
            return Q.when(this.request(this.getParams()))
            .then(function(json){
              return that.parse(json);
            });
          },
      });

      this.BlogFetcher = function(dataType,url){
        this.url = url;
        this.dataType = dataType;
      }

      _.extend(
          this.BlogFetcher.prototype, 
          this.AbstractFetcher.prototype,
          {
           parse : function(data) {
             var items = [];
             _.each(data, function(item) {
               var created_date = new Date(item.created);
               // We're using Q.fulfill here because all information we want at
               // this moment is already in the retrieved data.  
               items.push(Q.fulfill(new Models.BlogItem({
                 id : item.id,
                 title : item.title,
                 description : item.description,
                 created : item.created,
                 created : {
                   year : created_date.getFullYear(),
                   month : created_date.getMonth()+1,
                   day : created_date.getDay() + 1,
                 }, 
                 url : item.url,
                 tags : item.tags,
               })));
             });
             return items;
          }
        }
      );


     this.GistFetcher = function(username) {
         this.url = 'https://api.github.com/users/' + username +'/gists'; 
         this.dataType = "jsonp";
         this.fetched = false;
      };

      _.extend(
          this.GistFetcher.prototype, 
          this.AbstractFetcher.prototype,
          {
           parse : function(data) {
               var that = this;
               var promises = [];
               _.each(data.data, function(gist) {
                 var updated_date = new Date(gist.updated_at);
                 var created_date = new Date(gist.created_at);
                 promises.push(Q.fulfill(new Models.Gist({
                   id : gist.id,
                   title : gist.description,
                   author : gist.user.login,
                   html_url: gist.html_url,
                   updated : {
                     year : updated_date.getFullYear(),
                     month : updated_date.getMonth() +1,
                     day : updated_date.getDay() + 1,
                   },
                   created : {
                     year : created_date.getFullYear(),
                     month : created_date.getMonth()+1,
                     day : created_date.getDay() + 1,
                   }, 
                   files : gist.files,
                 })));
               });
               return promises;
           }
     });

     this.InstaPaperFetcher = function(feedurl) {
         this.url = 'http://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent('select * from xml where url="' + feedurl + '"') + '&format=json';
         this.fetched = false;
         this.dataType = 'jsonp';
      };

      _.extend(
          this.InstaPaperFetcher.prototype, 
          this.AbstractFetcher.prototype,
          {
           parse : function(data) {
                 var that = this;
                 var promises = [];
                 _.each(data.query.results.rss.channel.item, function(item) {
                   var created_date = new Date(item.pubDate);
                   promises.push(Q.fulfill(new Models.InstaPaper({
                     title : item.title,
                     description : item.description,
                     created : {
                       year : created_date.getFullYear(),
                       month : created_date.getMonth()+1,
                       day : created_date.getDay() + 1,
                     }, 
                     url : item.link,
                   })));
                 });
               return promises;
           }
      });

      this.PageFetcher = function(user,repo,folder) {
         this.url = 'https://api.github.com/repos/'+user+'/'+repo+'/contents/'+folder;
         this.fetched = false;
         this.dataType = 'jsonp';
      };

      _.extend(this.PageFetcher.prototype, 
          this.AbstractFetcher.prototype,
          {
            getParams : function() {
              return {
                dataType : 'jsonp',
                url: this.url,
                data : { ref : 'master'},
                headers : {
                  'Accept': 'application/vnd.github.beta+json'
                }
              }
            },
            parse : function(data) {
               var that = this;
               var promises = [];
               _.each(data.data, function(page) {
                   if (page.type=='file'){
                     var page = new Models.Page({
                       name : page.name,
                       path : page.path,
                       url : page._links.self,
                       giturl : page._links.git, 
                     });
                     
                     promises.push(Q.when(
                      page.fetch()
                     ));
                   }
               });
              return promises;
            }
          }
      );

      this.PicasaFetcher = function(uid) {
         this.url = 'https://picasaweb.google.com/data/feed/api/user/' + uid + '?alt=json';
         this.fetched = false;
         this.dataType = 'jsonp';
      };

      _.extend(this.PicasaFetcher.prototype, 
          this.AbstractFetcher.prototype,
          {
           parse : function(data) {
             var that = this;
             var promises = [];
             _.each(data.feed.entry, function(album) {
               var updated_date = new Date(album.updated.$t);
               var created_date = new Date(album.published.$t);
               promises.push(Q.fulfill(new Models.Album({
                 id : album.gphoto$id.$t,
                 title : album.title.$t,
                 description : album.summary.$t,
                 author : album.author[0].name,
                 updated : {
                   year : updated_date.getFullYear(),
                   month : updated_date.getMonth() +1,
                   day : updated_date.getDay() + 1,
                 },
                 created : {
                   year : created_date.getFullYear(),
                   month : created_date.getMonth()+1,
                   day : created_date.getDay() + 1,
                 },
                 thumbnails: album.media$group.media$thumbnail,
               })));
              });
              return promises;
            }
         }
      );
    };
    return new module();
});
