
  $(function() {
    var $tpl = $('#amz-tpl'),
      source = $tpl.text(),
      template = Handlebars.compile(source),
      data = {
        header: {
          "content": {
            "title": "萌宝圈",
            "link": "index.html",
            "right": [
              {
                "className" : "camera",
                "link": "#",
                "icon": "camera"
              }],
          },
          "options": {
            "fixed": true
          }
        },
        navbar: {
          "options": {
            "cols": "4",
            "iconpos": "top"
          },
          "content": [
            {
              "title": "萌宝圈",
              "link": "index.html",
              "icon": "child",
              "dataApi": ""
            },
            {
              "title": "个人中心",
              "link": "user.html",
              "icon": "user",
              "dataApi": ""
            },
            {
              "title": "分享",
              "icon": "share",
              "dataApi": "data-am-navbar-qrcode"
            },

          ]
        }
      },
      html = template(data);

    $tpl.before(html);

    // var reflow = $('body')[0].offsetHeight;

    $.each([], function(i, m) {
      var module = $.AMUI[m];
      module && module.init && module.init();
    })
  });
