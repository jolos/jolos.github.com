I've decided to revamp my personal website, this might seem odd as my previous one was only a few months old. But the truth is that I wasn't entirely satisfied with it. It was my first encounter with [Backbone.js](http://backbonejs.org/) and while the application works as it should. It's not the greatest example of a good architecture. After gaining more experience while building a git ( or rather github ) based [wiki](http://jolos.github.com/wiki/). I decided to build it from scratch. On a functional level the goals were still the same : 

* support for showing blogs
* support for showing pages
* support for showing albums
* nice animations

In addition I also wanted it to be easier to write blog posts with [prose.io](http://prose.io). 

But the real changes happend behind the html/css curtains. I still wanted to build a fully client based system based on backbone. But it had to be far more robust and easier to extend. That's something that wasn't easy enough before. It's now quite easy to add new functionality. 

The main concept or idea of the new version is that every page is a query. For this I've implemented a very simple query language, which allows you to display all matching items. So you can for example go to : http://jolos.github.com/#type/album/title/2012&!summer. This query will give you all items of type album wich contain the word 2012 and which not contain the word summer. This query language is already sufficient for doing most simple queries, but there's still room left for improvement. I should for example still add support for querying nested datastructures and using parentheses to expression precedence rules correctly. 

The provided query string will be recursively parsed into a filter. This filter is  built using the [decorator pattern](http://en.wikipedia.org/wiki/Decorator_pattern), so NOT, AND and OR filters can decorate another filter. 

Once the filter is parsed several fetchers are fired to fetch all items from several sources. These items are all added to a collection. If the item matches the filter it's then being copied to a second collection. The latter will be used by the main view to actually display the items. This main view relies on a view [factory](http://en.wikipedia.org/wiki/Factory_object) to construct and intialize the view that corresponds with the item. 

To conclude some words on the animations. This was something I struggled with while building my previous application. It's not easy to get the state flow 100% right. That's why this time I built an abstract StateView. You can use this stateview to control the states of your view. You just have to define states and the animation callbacks that correspond to the transitions between the states. 




