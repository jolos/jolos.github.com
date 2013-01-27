define(function() {
  var stubfiles = ['blogsresponse','pagesresponse', 'gistsresponse', 'instapaper', 'picasa'];
  var rtnval = {};

  stubfiles.forEach(function(item){
    jQuery.ajax({
      url : './' + item + '.stub',
      dataType : 'text',
      success : function(data) {
        rtnval[item] = data;
      }
    });
  });
  return rtnval;
});
