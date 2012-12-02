Lately I've been looking into the scala, a programming language that tries to combine oop & functional paradigms in an elegant way. In addition it's compatible with java ( scala compiles to java byte code ). This allowed scala to become more than a theoretical exercise. Companies like foursquare and twitter are now succesfully using scala, which stands for scalable-language, to power their backend. It's good to see that a great technology is popular aswell.

As an excercise to get more familiar with scala and surrounding technologies I've written a streamprocessor. You could see it as an 'alternative' to the famous [storm](http://storm-project.net) streamprocessor by twitter. To build the processor I've leveraged the following technologies/libraries :
 
 * The play 2.1 [iteratee library](http://www.playframework.org/documentation/2.0/Iteratees)
 * [Netty](http://netty.io) 4.0 (alpha) : A java library for event-based io 
 * [Rickshaw](http://code.shutterstock.com/rickshaw/) : a javascript library for timeseries based on [d3.js](http://d3js.org)

The rickshaw library is only used to visualise the data that the stream processor sends over websocket. 

My minimal streamprocessor is based on 2 concepts : Taps and Sinks. They are similar to Storm's Spout and Bolt concepts. A Tap will generate the stream, typically by getting data from an external system. In my application it listens to messages from statd daemons, but it could also fetchtweets from the twitter firehose. A Tap is in fact just a wrapper around an Enumerator ( for documentation on Iteratees check the play framework wiki ). A Sink is the endpoint ( in my example application it sends messages over a websocket ). You can connect a Tap with a Sink by providing an Enumeratee that will transform the stream, an example might be filtering tweets on hashtag.
 Enumeratee's are very powerful but I must admit that I'm not fully comfortable with the concept yet, so I still need to find out if there're things you can't do with Enumeratee's. I guess I'll have to find out while adding features.

To end a screenshot to show how it looks, if you want you can try it yourself, the code is available in my [repo](http://github.com/jolos/streamprocessor.png).
