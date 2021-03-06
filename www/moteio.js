/*jslint indent: 2 */

var io = io || null,
  localStorage = localStorage || null,
  console = console || null,
  navigator = navigator || null,
  $ = $ || null,
  device = device,
  window = window || null;

Pusher.log = function(message) {
  if (window.console && window.console.log) {
    window.console.log(message);
  }
};

var App = function () {

  "use strict";

  var self = this;

  self.remote_location = 'https://localhost:3000';
  //self.remote_location = 'https://mote.io:443';
  self.channel = null;

  self.set = function(key, data) {
    // Put the object into storage
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  }
  self.get = function(key) {
    // Retrieve the object from storage
    var retrievedObject = localStorage.getItem(key);
    if(typeof retrievedObject !== "undefined") {
      return JSON.parse(retrievedObject);
    } else {
      return false;
    }
  }

  self.shush = function () {
    if (self.channel) {
      self.channel.disconnect();
    } else {
      // console.log('not connected to any channels yet');
    }
  };

  self.populateHash = function (given, fallback) {
    if(typeof given !== "undefined" && given) {
      return given;
    }
    return fallback;
  }

  self.renderRemote = function(res) {

    var
      button_id = 0,
      wrapper = null,
      button_size = 0,
      element = null,
      buttons = null;

    if(typeof res == "undefined" || !res) {
      navigator.notification.alert('Connected to site but window.moteioConfig is not defined on web page.');
    } else if(typeof res.app_name == "undefined" || !res.app_name) {
      navigator.notification.alert('Please supply an app name in the moteioConfig.')
    }

    $('.ui-title').text(res.app_name);
    $('#remote-render').html('');

    var id = 0;

    for(var key in res.blocks) {

      var type = res.blocks[key].type,
      params = res.blocks[key];

      params._id = id;
      id++;

      type = params.type;

      if(type == "notify") {

        wrapper = $('<div class="block"></div>');
        var notify = $('<div class="notify"></div>');

        $('#remote-render').append(wrapper.append(notify).append('<div class="block share" style="display: none;"><div class="buttons"><span class="icon-facebook facebook moteio-button"></span><span class="moteio-button icon-twitter twitter"></span></div></div>'));

      }

      if(type == "buttons") {

        var container = $("<div class='buttons'></div>");

        var i = 0;
        $.each(params.data, function(index, button){

          var data = {
            block_id: params._id,
            _id: i,
            hash: self.populateHash(button.hash, params._id + '_' + i),
            uuid: device.uuid
          }

          var data = self.populateHash(params.hash, data);

          element = $('<span id="moteio-button-' + data.hash + '" class="moteio-button icon-' + button.icon + '" /></span>')
            .bind('vmousedown', function (e) {

              navigator.notification.vibrate(250);
              e.stopPropagation();

              data.press = true;

              self.channel.trigger('client-input', data);

            });

            container.append(element);
            i++;

        });

        $('#remote-render').append($('<div class="block"></div>').append(container));
      }

      if(type == "select") {

        var select_html = $('<select class="render-select"></select>');

        for(var option in params.data){
          var option_html = $('<option value="' + option + '" data-paramid="' + params._id + '">' + params.data[option].text + '</option>');
          if(typeof params.data[option].optgroup !== "undefined") {
            if(select_html.find('optgroup[label=' + params.data[option].optgroup + ']').html() == null){
              select_html.append('<optgroup label="' + params.data[option].optgroup + '"></optgroup>')
              select_html.find('optgroup[label=' + params.data[option].optgroup + ']').append(option_html);
            } else {
              select_html.find('optgroup[label=' + params.data[option].optgroup + ']').append(option_html);
            }
          } else {
            select_html.append(option_html);
          }
        }

        select_html.bind('change', function(e) {

          var option_data = $(this).find(":selected").data();

          var data = {
            block_id: option_data.paramid,
            _id: $(this).val(),
            hash: option_data.paramid + '_' + $(this).val(),
            uuid: device.uuid
          }

          self.channel.trigger('client-select', data);

        });

        $('#remote-render').append($('<div class="block"></div>').append(select_html));

        $(".render-select").selectmenu();

      }

      if(type == "search") {

        var search_html = $('<form id="remote-search-form" class="block" data-enhance="false"><label for="search-basic" style="display: none">Search Input:</label><input type="search" class="render-search" name="remote-search" id="remote-search" value=""></form>');

        var data = {
          block_id: params._id,
          hash: params._id,
          uuid: device.uuid
        }

        search_html.bind('submit', function(e) {

          data.query =  $("#remote-search-form").val()

          self.channel.trigger('client-search', data);

          return false;

        });

        $('#remote-render').append(search_html);

        $('.render-search').textinput();

      }

    }

    buttons = $('.moteio-button');

    $.mobile.changePage($('#remote'));

  };

  self.listen = function (username) {

    var pusher = new Pusher('9c3e18d7beee023a1f8c', {
      encrypted: true,
      authTransport: 'jsonp',
      authEndpoint: self.remote_location + '/pusher/auth'
    });

    pusher.connection.bind('state_change', function(states) {
      // states = {previous: 'oldState', current: 'newState'}
     console.log(states.current);
    });

    self.channel_name = 'private-' + username;
    self.channel = pusher.subscribe(self.channel_name);

    pusher.connection.bind('connecting', function() {
      console.log('connecting');
      $('#status-message').html('<p>Connecting...</p>');
      $.mobile.changePage($('#status'));
    });

    pusher.connection.bind('failed', function() {
      console.log('connecting');
      $('#status-message').html('<p>Pusher is not supported by your platform!</p>');
      $.mobile.changePage($('#status'));
    });

    pusher.connection.bind('disconnected', function() {
      console.log('disconnected');
      $('#status-message').html('<p>Disconnected...</p>');
      $.mobile.changePage($('#status'));
    });

    pusher.connection.bind('connecting_in', function(delay) {
      console.log('disconnected');
      $('#status-message').html('<p>Reconnecting in ' + delay + ' seconds...</p>');
      $.mobile.changePage($('#status'));
    });

    pusher.connection.bind('connected', function() {

      self.channel.bind('pusher:subscription_succeeded', function() {
         self.channel.trigger('client-get-config', {});
      });

      self.channel.bind('client-connect_failed', function (reason) {
        navigator.notification.alert('Your session has become invalid. Please login again.');
        self.logout();
      });

      self.channel.bind('client-connect_failed', function () {
        console.log('connect_failed');
        $.mobile.changePage($('#login'));
      });

      self.channel.bind('unavailable', function () {
        console.log('unavailable');
        $.mobile.changePage($('#login'));
        navigator.notification.alert('No internet connection available!');
      });

      self.channel.bind('client-reconnecting', function () {
        console.log('reconnecting');
        $('#status-message').html('<p>Reconnecting...</p>');
        $.mobile.changePage($('#status'));
      });

      self.channel.bind('client-update-config', function (data) {

        console.log('update-config')
        self.renderRemote(data);
        self.channel.trigger('client-got-config', {});

      });

      self.channel.bind('client-reconnect', function () {
        console.log('reconnect');
        self.channel.trigger('client-get-config', {});
      });

      self.channel.bind('client-notify', function (data) {

        var now_playing = $('.notify');
        now_playing.empty();

        if (typeof data.image !== "undefined" && data.image) {
          now_playing.append('<img src="' + data.image + '" class="thumb" />');
        }
        if (typeof data.line1 !== "undefined") {
          now_playing.append('<div class="line line-1">' + data.line1 + '</p>');
        }
        if (typeof data.line2 !== "undefined") {
          now_playing.append('<div class="line line-2">' + data.line2 + '</p>');
        }

      });

      self.channel.bind('client-update-button', function(data){

        if(data.icon) {
          $('#moteio-button-' + data.hash).removeClass().addClass('moteio-button icon-' + data.icon);
        }

        if(data.color) {
          $('#moteio-button-' + data.hash).css({
            'color': data.color
          });
        }

      });

    });

    $('.go-home').click(function(){
      self.channel.trigger('client-go-home', {});
    });

  };

  self.logout = function () {
    $('#remote-render').html('');
    $.mobile.changePage($('#login'));
  }

  self.offline = function() {
  }

  self.init = function () {

    if(navigator.connection.type !== Connection.WIFI && navigator.connection.type !== Connection.ETHERNET) {
      navigator.notification.alert('Try connecting to a Wifi network, it makes Mote.io faster!')
    }

    var data = null;

    $("#login-form").submit(function (e) {

      e.preventDefault();

      console.log('login form submit')

      $('#status-message').html('<p>Logging In...</p>');
      $.mobile.changePage($('#status'));

      var data = $(this).serializeArray();

      $.ajaxSetup({
        statusCode: {
          401: function(){
            // Redirec the to the login page.
            navigator.notification.alert('Error authorizing.')
            $.mobile.changePage($('#login'));
          }
        }
      });

      $.ajax({
        type: 'post',
        url: self.remote_location + '/post/login',
        data: $(this).serialize(),
        dataType: 'jsonp',
        timeout: 8000,
        success: function(response) {

          if(response.valid) {

            if(data[2].value == "1") {
              self.set('login', data);
            } else {
              self.set('login', null)
            }

            self.listen(response.user._id);

            console.log('waiting for sync')
            $('#status-message').html('<p>Syncing...</p><p>Visit <b>http://mote.io/start</b> on your computer for help.</p>');
            $.mobile.changePage($('#status'));

          } else {
            $.mobile.changePage($('#login'));
            navigator.notification.alert(response.reason);
          }

        },
        error: function(xhr, status, err) {

          navigator.notification.alert('The server is probably down. Please try again later.');
          $.mobile.changePage($('#login'));
        }
      });

      return false;

    });

    $('#logout').click(function(){
      self.shush();
      self.logout();
      $.mobile.changePage($('#login'));
    });

    if(self.get('login')) {

      var data = self.get('login')

      $('#username').val(data[0].value)
      $('#password').val(data[1].value)
      $('#remember-me').val('1')
      // $("#login-form").submit();

    }

    $(document).bind("mobileinit", function(){
      $.mobile.defaultPageTransition = 'none';
      $.mobile.defaultDialogTransition = 'none';
      $.mobile.useFastClick = true;
    });

    window.plugins.childBrowser.onLocationChange = function (url) {
      if(url == "https://mote.io/start") {
        window.plugins.childBrowser.close();
        navigator.notification.alert('It worked! Sign in and vist https://mote.io/start on your computer.');
        $.mobile.changePage($('#login'));
      }
    };

    navigator.splashscreen.hide();
    $.mobile.changePage($('#login'));

  };

};
