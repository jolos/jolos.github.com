/*jslint indent: 2, browser: true */
/*global sinon,test,module, stop, equal, start*/
function run_tests(Fetchers, stubs, Q, Models, Views) {
  'use strict';
  sinon.config = {
    injectIntoThis: true,
    injectInto: null,
    properties: ["spy", "stub", "mock", "clock", "sandbox"],
    useFakeTimers: true,
    useFakeServer: false
  };

  module('fetchers');

  test("Test PageFetcher", function () {
    stop();
    // we expect 3 assertions
    expect(3);

    var server = sinon.fakeServer.create();
    //var server = sinon.sandbox.useFakeServer();
    server.autoRespond = true;

    server.respondWith(
      'GET',
      "/testpages",
      ["200", { "Content-Type": "application/json" }, stubs.pagesresponse]
    );

    var fetcher = new Fetchers.PageFetcher();

    // TODO, getting sinon to fake the real response is too difficult.
    fetcher.getParams = function () {
      return {
        dataType: 'json',
        url : '/testpages'
      }
    };

    var promise, parseorigin, that;
    promise = fetcher.fetch();
    parseorigin = fetcher.parse;
    that = this;
    // When we're doing the async call, the xhr object will be reset, so we need
    // to create the fakeserver again, by wrapping the parse method
    // TODO: maybe there's a better way?
    fetcher.parse = function (data) {
      var server, result;
      server = sinon.fakeServer.create();
      server.autoRespond = true;

      server.respondWith(
        'GET',
        "/page/1.html",
        ["200", { "Content-Type" : "text/html"}, "<div>stubhtml</div>"]
      );

      result = parseorigin(data);
      server.respond();
      return result;
    };

    var items = [];
    promise.then(function (promises) {
      equal(promises.length, 1, "Array with promises has length 1");
      // add an extra operation to the existing promises
      var newpromises = [];
      promises.forEach(function (promise) {
        // Once a promise is fulfilled, push the value into the items array
        newpromises.push(promise.then(function (item) {
          items.push(item);
          return item;
        }).fail(function (err) {
          console.log(err);
        }));
      });

      // combine the array of promises into 1 promise.
      return Q.all(newpromises);
    }, function (err) {
      ok(false, ":-/");
    }).then(function (result) {
      equal(items.length, 1, "1 Page added to array");
      equal(result[0].get('content'), "<div>stubhtml</div>", "Retrieved html has expected value");
    }).fail(function (err) {
       ok(false, "Fetching Pages failed");
    }).done(function () {
      server.restore();
      start();
    });

    server.respond();
  });

  test("Test PageFetcher (no stub)", 1,function () {
    sinon.config.useFakeServer = false;
    stop();
    var fetcher, promise, items;

    fetcher = new Fetchers.PageFetcher('jolos', 'jolos.github.com', 'pages');

    promise = fetcher.fetch();
    items = [];
    promise.then(function (promises) {
      var newpromises = [];
      promises.forEach(function (promise) {
        newpromises.push(promise.then(function (item) {
          items.push(item);
          return item;
        }));
      });

      // We could use the original 'promises' array here, as these are not
      // asynchronous promises.
      return Q.all(newpromises);
    }, function (err) {
      ok(false, "Parsing Failed");
    }).then(function (result) {
       ok(items.length, "Array is not empty");
    }).fail(function (err) {
       ok(false, "Fetching From github failed");
    }).done(function () {
      start();
    });
  });


  test("Test BlogFetcher", 1, function () {
    stop();
    var server, fetcher, promise, items;
    server = sinon.fakeServer.create();
    server.autoRespond = true;

    server.respondWith(
      "GET", "/test",
      ["200", { "Content-Type": "application/json" }, stubs.blogsresponse]
    );

    fetcher = new Fetchers.BlogFetcher('json', '/test');
    promise = fetcher.fetch();
    items = [];
    promise.then(function (promises) {
      var newpromises = [];
      promises.forEach(function (promise) {
        newpromises.push(promise.then(function (item) {
          items.push(item);
        }));
      });

      // We could use the original 'promises' array here, as these are not
      // asynchronous promises.
      return Q.all(newpromises);
    }, function(err) {
      ok(false, ":-/");
    }).then(function () {
      equal(items.length, 5, "5 BlogItems added to array");
    }).fail(function (err) {
      ok(false, "Fetching Blogs failed");
    }).done(function () { 
      server.restore();
      start();
    });

    server.respond();
  });

  test("Test GistFetcher (with stub)", 1, function () {
    stop();
    var server, fetcher, promise, items;
    server = sinon.fakeServer.create();
    server.autoRespond = true;

    server.respondWith(
      "GET", "/gists",
      ["200", { "Content-Type": "application/json" },
      stubs.gistsresponse]
    );

    fetcher = new Fetchers.GistFetcher();
    fetcher.url = '/gists';
    fetcher.dataType = 'json';

    promise = fetcher.fetch();
    items = [];
    promise.then(function (promises) {
      var newpromises = [];
      promises.forEach(function (promise) {
        newpromises.push(promise.then(function (item) {
          items.push(item);
          return item;
        }));
      });

      // We could use the original 'promises' array here, as these are not
      // asynchronous promises.
      return Q.all(newpromises);
    }, function (err) {
      ok(false, ":-/");
    }).then(function (result) {
       equal(items.length, 1, "1 Gist added to array");
    }).fail(function (err) {
       ok(false, "Fetching Gists failed");
    }).done(function () {
      server.restore();
      start();
    });

    server.respond();
  });

  test("Test GistFetcher (no stub)", 1, function () {
    var fetcher, promise, items;
    items = [];
    sinon.config.useFakeServer = false;
    stop();

    fetcher = new Fetchers.GistFetcher('jolos');
    promise = fetcher.fetch();

    promise.then(function (promises) {
      var newpromises = [];
      promises.forEach(function (promise) {
        newpromises.push(promise.then(function (item) {
          items.push(item);
          return item;
        }));
      });

      // We could use the original 'promises' array here, as these are not
      // asynchronous promises.
      return Q.all(newpromises);
    }, function (err) {
      ok(false, "Parsing Failed");
    }).then(function (result) {
       ok(items.length, "Array is not empty");
    }).fail(function (err) {
       ok(false, "Fetching Instapaer failed");
    }).done(function () {
      start();
    });
  });

  test("Test InstaPaperFetcher (with stub)", 1, function () {
    stop();
    var server, fetcher, items, promise;
    server = sinon.fakeServer.create();
    server.autoRespond = true;

    server.respondWith(
      "GET", "/instapaper",
      ["200", { "Content-Type": "application/json" }, stubs.instapaper]
    );

    fetcher = new Fetchers.InstaPaperFetcher();
    fetcher.url = '/instapaper';
    fetcher.dataType = 'json';

    promise = fetcher.fetch();
    items = [];
    promise.then(function (promises) {
      var newpromises = [];
      promises.forEach(function (promise) {
        newpromises.push(promise.then(function (item) {
          items.push(item);
          return item;
        }));
      });

      // We could use the original 'promises' array here, as these are not
      // asynchronous promises.
      return Q.all(newpromises);
    }, function (err) {
      ok(false, "Parsing Failed");
    }).then(function (result) { 
       equal(items.length, 10, "10 Instapaper entries  added to array");
    }).fail(function (err) {
       ok(false, "Fetching Instapaper failed");
    }).done(function () {
      server.restore();
      start();
    });

    server.respond();
  });

  test("Test InstaPaperFetcher (no stub)", 1, function () {
    var fetcher, promise, items;
    sinon.config.useFakeServer = false;
    stop();

    fetcher = new Fetchers.InstaPaperFetcher('http://www.instapaper.com/starred/rss/2609795/rU9MxwxnbvWbQs3kHyhdoLkeGbU');

    promise = fetcher.fetch();
    items = [];
    promise.then(function (promises) {
      var newpromises = [];
      promises.forEach(function (promise) {
        newpromises.push(promise.then(function (item) {
          items.push(item);
          return item;
        }));
      });

      // We could use the original 'promises' array here, as these are not
      // asynchronous promises.
      return Q.all(newpromises);
    }, function (err) {
      ok(false, "Parsing Failed");
    }).then(function (result) {
       ok(items.length, "Array is not empty");
    }).fail(function (err) {
       ok(false, "Fetching Instapaer failed");
    }).done(function () {
      start();
    });
  });


  test("Test PicasaFetcher ( with stub )", 2, function () {
    stop();
    var server, promise, items, fetcher;
    server = sinon.fakeServer.create();
    server.autoRespond = true;

    server.respondWith(
      "GET", "/picasa",
      ["200", { "Content-Type": "application/json" },
      stubs.picasa]
    );

    fetcher = new Fetchers.PicasaFetcher();
    fetcher.url = '/picasa';
    fetcher.dataType = 'json';

    var promise = fetcher.fetch();
    var items = [];
    promise.then(function(promises){
      var newpromises = [];
      promises.forEach(function(promise) {
        newpromises.push(promise.then(function(item){
          items.push(item);
          return item;
        }));
      });

      // We could use the original 'promises' array here, as these are not
      // asynchronous promises.
      return Q.all(newpromises);	
    }, function(err){
      ok(false, "Parsing Failed");
    }).then(function(result) { 
       equal(items.length, 10, "10 Albums  added to array");
       // return first album to test fetching thumbs
       return result[0];
    }).fail(function(err){
       ok(false, "Fetching Picasa Albums failed");
    }).then(function(album){
      // fetch and return the promise
      return album.fetch();
    }).then(function(album){
      // Finally do the assert
      ok(album.get('thumbnails').length, "Array of thumbs is not empty");
    }).done(function(){ 
      server.restore();
      start();
    });

    server.respond();
  });

  test("Test PicasaFetcher (no stub)", 1,function () {
    sinon.config.useFakeServer = false;
    stop();

    var fetcher = new Fetchers.PicasaFetcher('103884336232903331378');

    var promise = fetcher.fetch();
    var items = [];
    promise.then(function(promises){
      var newpromises = [];
      promises.forEach(function(promise) {
        newpromises.push(promise.then(function(item){
          items.push(item);
          return item;
        }));
      });

      // We could use the original 'promises' array here, as these are not
      // asynchronous promises.
      return Q.all(newpromises);	
    }, function(err){
      ok(false, "Parsing Failed");
    }).then(function(result) { 
       ok(items.length, "Album Array is not empty");
    }).fail(function(err){
       ok(false, "Fetching Picasa Albums failed");
    }).done(function(){ 
      start();
    });
  });


  module('views');

  test("Test PageView", function(){
    var m = new Models.Page({content: "<h1>testtext</h1>"});
    var view =new Views.PageView({model:m});
    view.render();
    equal(view.$('h1').text(),'testtext');
  });

  test("Test InstaPaperView", function(){
    var m = new Models.InstaPaper({
      title: "title",
      url: "http://jolos.github.com",
      description: "<div>summary</div>",
      created: {
        day: "1",
        month: "1",
        year: "2013",
      },
    });

    var view =new Views.InstaPaperView({model:m});
    view.render();
    equal(view.$('a').attr('href'), 'http://jolos.github.com');
  });


  test("Test StateView", function(){
    expect(4);
    var v = new Views.StateView({});
    v.states.push('end');

    v.setTransition('start', 'end', function(){
      var deferred = Q.defer();
      setTimeout(function () {
        deferred.resolve("ok");
      }, 200);
      return deferred.promise;
    });

    v.on('end', function(prev_state, promise){
      console.log(prev_state);
      if (prev_state == 'start'){
        ok(true, 'Successfully catched start:end transition');
      }
    });

    equal(v.getCurrentState(), 'start', 'Initial state is start');

    var promise = v.doTransition('end');
    
    promise.fin(function () {

      ok(promise.isFulfilled(), "Successfully transitioned to state end");

      equal(v.getCurrentState(), 'end', 'State after transition is state end');

      start();
    });

    var promised_state = v.getPromisedState().then(function (state) {
      ok(state == 'end', 'promised state is end');
    });

    var promise2 = v.doTransition('start');

    stop();
    
  });

  test("Test StateView 2", function(){
    expect(6);
    var v = new Views.StateView({});
    v.states.push('end');
    v.states.push('dummy');

    v.setTransition('start', 'start', function(){
      var deferred = Q.defer();
      setTimeout(function () {
        deferred.resolve("ok");
      }, 200);
      return deferred.promise;
    });

    v.setTransition('start', 'dummy', function(){
      var deferred = Q.defer();
      setTimeout(function () {
        deferred.resolve("ok");
      }, 200);
      return deferred.promise;
    });


    var promises = [];
    promises.push(v.doTransition('start'));
    promises.push(v.doTransition('start'));
    promises.push(v.doTransition('end'));
      
    promises[0].fin(function () {
      ok(promises[0].isFulfilled(), "1st promise is fulfilled");
    });

    promises[1].fin(function () {
      ok(promises[1].isFulfilled(), "2nd promise is fulfilled");
    });

    
    // Allow to recover from error.
    promises[2].fail(function () {
      ok(true, "3rd promise is rejected");

      // recover
      return Q.fulfill('ok');
    });

    promises.push(v.doTransition('dummy'));

    promises[3].fail(function () {
      ok(v.getCurrentState() == 'start', 'State is start');

      ok(promises[3].isRejected(), "4th promise is rejected");

      // Try again.
    }).fin(function () {
     v.doTransition('dummy')
        .then(function () { 
          ok(v.getCurrentState() == 'dummy', 'State is dummy');
        }).fin(function () { start(); });
    });

   stop();
  });
  // TODO: write higher level tests that interact with the views/dom
}

