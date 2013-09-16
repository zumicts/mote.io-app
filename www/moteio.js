/*jslint indent: 2 */

var io = io || null,
  localStorage = localStorage || null,
  console = console || null,
  navigator = navigator || null,
  $ = $ || null,
  device = device,
  window = window || null;

var App = function () {

  "use strict";

  var self = this;

  self.remote_location = 'https://localhost:3000';
  //self.remote_location = 'https://mote.io:443';

  self.channel = null;
  self.pubnub = null;
  self.channel_name = null;

  self.lastNotify = {};
  self.config = {};

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

  self.populateHash = function (given, fallback) {
    if(typeof given !== "undefined" && given) {
      return given;
    }
    return fallback;
  }

  self.renderRemote = function(res) {

    if(typeof res == "undefined" || !res) {
      alert('Connected to site but window.moteioConfig is not defined on web page.');
    } else if(typeof res.app_name == "undefined" || !res.app_name) {
      alert('Please supply an app name in the moteioConfig.')
    }

    self.config = res;

    var
      button_id = 0,
      wrapper = null,
      button_size = 0,
      element = null,
      buttons = null;

    $('#remote-render').html('');

    var id = 0;

    for(var key in self.config.blocks) {

      var type = self.config.blocks[key].type,
        params = self.config.blocks[key];

      params._id = id;
      id++;

      type = params.type;

      if(type == "notify") {

        var wrapper = $('<div class="block"></div>'),
          notify = $('<div class="notify"></div>'),
          text = null;

        $('#remote-render').append(wrapper.append(notify));

        if(typeof params.share !== "undefined" && params.share) {
          wrapper.append('<div class="block share"><div class="buttons"><span class="icon-facebook facebook moteio-button ui-btn-up-a"></span><span class="moteio-button ui-btn-up-a icon-twitter twitter"></span></div></div>');
        }

        $('.twitter, .facebook').bind('vclick', function(){

          var text = 'I\'m ' + self.config.action + ' to ' + self.lastNotify.line1;
          if(self.lastNotify.line2) {
            text += ' - ' + self.lastNotify.line2
          }

          console.log(self.config)

          var url = 'https://mote.io/share?line1=' + encodeURIComponent(self.lastNotify.line1) + '&line2=' + encodeURI(self.lastNotify.line2) + '&image=' + encodeURI(self.lastNotify.image) + '&remote=' + encodeURIComponent($('.ui-title').text()) + '&url=' + encodeURIComponent(self.lastNotify.url);
          if($(this).hasClass('twitter')) {

            if(typeof self.config.twitter !== "undefined" && self.config.twitter) {
              text += ' on @' + self.config.twitter;
            } else {
              text += ' on ' + $('.ui-title').text();
            }
            text += ' ' + self.lastNotify.permalink;
            text += ' via @getmoteio';

            url = 'http://www.twitter.com/share?text=' + encodeURIComponent(text);

            console.log(url);
            window.open(url, '_blank');

          } else {

            text += ' on ' + $('.ui-title').text() + ' with Mote.io http://mote.io';

            var params = {
              method: 'feed',
              name: 'Mote.io',
              link: self.lastNotify.permalink,
              picture: 'https://mote.io/images/144-2x.png',
              caption: text,
              description: 'Remote control your favorite sites like' + $('.ui-title').text() + 'with Mote.io'
            };

            FB.ui(params, function(obj) { });

          }

        });

      }

      if(type == "buttons") {

        var container = $("<div class='buttons'></div>");

        var i = 0;
        $.each(params.data, function(index, button){

          var data = {
            block_id: params._id,
            _id: i,
            hash: self.populateHash(button.hash, params._id + '_' + i)
          }

          var data = self.populateHash(params.hash, data);

          element = $('<span id="moteio-button-' + data.hash + '" class="moteio-button ui-btn-up-a icon-' + button.icon + '" /></span>')
            .bind('vclick', function (e) {

              navigator.notification.vibrate(300);

              e.stopPropagation();

              data.press = true;

              self.pubnub.publish({
                channel : self.channel_name,
                message : {
                  type: 'input',
                  data: data
                }
              });

            });

            container.append(element);
            i++;
        });

        $('#remote-render').append($('<div class="block"></div>').append(container));
      }

      if(type == "select") {

        var select_html = $('<select class="render-select"></select>');

        if(typeof params.title !== "undefined") {
          select_html.append($('<option>' + params.title + '</option>'));
        }

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
            hash: option_data.paramid + '_' + $(this).val()
          }

          self.pubnub.publish({
            channel : self.channel_name,
            message : {
              type: 'select',
              data: data
            }
          });

        });

        $('#remote-render').append($('<div class="block"></div>').append(select_html));

        $(".render-select").selectmenu();

      }

      if(type == "search") {

        var search_html = $('<form id="remote-search-form" class="block" data-enhance="false"><label for="search-basic" style="display: none">Search Input:</label><input type="search" class="render-search" name="remote-search" id="remote-search" value=""></form>');

        var data = {
          block_id: params._id,
          hash: params._id
        }

        search_html.bind('submit', function(e) {

          data.query =  $("#remote-search").val();

          self.pubnub.publish({
            channel : self.channel_name,
            message : {
              type: 'search',
              data: data
            }
          });

          return false;

        });

        $('#remote-render').append(search_html);

        $('.render-search').textinput();

      }

    }

    buttons = $('.moteio-button');

    $.mobile.changePage($('#remote'));
    $('.ui-title').text(res.app_name);

  };

  self.listen = function (channel_name) {

    self.channel_name = channel_name;

    if(channel_name) {

      self.pubnub.subscribe({
        channel: self.channel_name,
        connect: function() {

          self.pubnub.publish({
            channel : self.channel_name,
            message : {
              type: 'get-config'
            }
          });

        },
        disconnect: function() {

          alert('disconnected')
          self.logout();

        },
        reconnect: function() {

          alert('reconnected')
          self.pubnub.publish({
            channel : self.channel_name,
            message : {
              type: 'get-config'
            }
          });

        },
        message: function( message) {

          var data = null;
          if(message.data !== "undefined") {
            data = message.data;
          }

          if(message.type == 'update-config') {

            self.renderRemote(data);

            self.pubnub.publish({
              channel : self.channel_name,
              message : {
                type: 'got-config'
              }
            });

          }

          if(message.type == 'notify') {

            var now_playing = $('.notify');
            now_playing.empty();

            if (typeof data.image !== "undefined") {
              now_playing.append('<img src="' + data.image + '" class="thumb" />');
            }
            if (typeof data.line1 !== "undefined") {
              now_playing.append('<div class="line line-1">' + data.line1 + '</p>');
            }
            if (typeof data.line2 !== "undefined") {
              now_playing.append('<div class="line line-2">' + data.line2 + '</p>');
            }

            self.lastNotify.line1 = data.line1;
            self.lastNotify.line2 = data.line2;
            self.lastNotify.image = data.image;
            self.lastNotify.permalink = data.permalink;
            self.lastNotify.url = data.url;

          }

          if(message.type == 'update-button') {

            if(data.icon) {
              $('#moteio-button-' + data.hash).removeClass().addClass('moteio-button ui-btn-up-a icon-' + data.icon);
            }

            if(data.color) {
              $('#moteio-button-' + data.hash).css({
                'color': data.color
              });
            }

          }

        }

      });

      $('.go-home').bind('vclick', function(){

        navigator.notification.vibrate(300);

        self.pubnub.publish({
          channel : self.channel_name,
          message : {
            type: 'go-home'
          }
        });

      });

    }

  };

  self.logout = function () {
    self.pubnub.unsubscribe({ channel : self.channel_name })
    $('#remote-render').html('');
    $.mobile.changePage($('#login'));
  }

  self.offline = function() {
  }

  self.pause = function() {
  }

  self.resume = function() {
    self.listen(self.channel_name);
  }

  self.init = function () {

    self.pubnub = PUBNUB.init({
      publish_key: 'pub-2cc75d12-3c70-4599-babc-3e1d27fd1ad4',
      subscribe_key: 'sub-cfb3b894-0a2a-11e0-a510-1d92d9e0ffba',
      origin        : 'pubsub.pubnub.com',
      ssl           : true,
      restore       : true
    });

    if(navigator.connection.type !== Connection.WIFI && navigator.connection.type !== Connection.ETHERNET) {
      alert('Try connecting to a Wifi network, it makes Mote.io faster!')
    }

    var data = null;

    $("#login-form").submit(function (e) {

      $('#status-message').html('<p>Logging In...</p>');
      $.mobile.changePage($('#status'));

      var data = $(this).serializeArray();

      $.ajaxSetup({
        statusCode: {
          401: function(){
            // Redirec the to the login page.
            alert('Error authorizing.')
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
              $('#password').val('');
            }

            self.listen(response.channel_name);

            $('#status-message').html('<p>Syncing...</p><p>Visit <a>http://mote.io/start</a> on your computer for help.</p>');
            $.mobile.changePage($('#status'));

          } else {
            $.mobile.changePage($('#login'));
            alert(response.reason);
          }

        },
        error: function(xhr, status, err) {

          alert('There was a problem logging you in or the server timed out. Check your username and password.');
          $.mobile.changePage($('#login'));
        }
      });

      return false;

    });

    $('.logout').bind('vclick', function(){
      self.logout();
      $.mobile.changePage($('#login'));
    });

    $('.sign-up').bind('vclick', function(){

      var ref = window.open('https://mote.io/register', '_blank');
      ref.addEventListener('loadstart', function(event) {
        if(event.url == "https://mote.io/start") {
          ref.close();
          alert('All signed up! Now log in.');
        }
      });

    });

    $('.forgot-password').bind('vclick', function(){
      var ref = window.open('https://mote.io/reset', '_blank');
    });

    if(self.get('login')) {

      var data = self.get('login')

      $('#username').val(data[0].value);
      $('#password').val(data[1].value);
      $('#remember-me').val('1').slider('refresh');
      // $("#login-form").submit();

    }

    navigator.splashscreen.hide();
    $.mobile.changePage($('#login'));

  };

};
