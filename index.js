/* Passport Middlewares */
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const TwitterStrategy = require('./passport-twitter/lib').Strategy;
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const GitHubStrategy = require('passport-github').Strategy;
const LinkedInStrategy = require('passport-linkedin').Strategy;
const InstagramStrategy = require('passport-instagram').Strategy;
const AmazonStrategy = require('passport-amazon').Strategy;
const FoursquareStrategy = require('passport-foursquare').Strategy;
const ImgurStrategy = require('passport-imgur').Strategy;
const MeetupStrategy = require('passport-meetup').Strategy;
const AppleStrategy = require('passport-apple').Strategy;
// const TumblrStrategy = require('passport-tumblr').Strategy;
// const VKontakteStrategy = require('passport-vkontakte').Strategy;

/* Misc */
const toolset = console;


var socialLoginClass = function (options) {
  var scope = this;
  this._basePath = options._basePath || "/";
  this.disableSession = options.disableSession || false;
  this.returnRaw = options.returnRaw || false;
  this.app = options.app || {};
  this.onAuth = options.onAuth || function () {
  };
  this.url = options.url || 'http://127.0.0.1';
  this.logout = options.logout || {url: '/logout', after: '/'};


  // Special Cases
  // PassportJS doesn't have a standardized API, with its property names changing from Strategy to Strategy.
  // Here we fix that, taking social-login's standardized API and turning it into what Passportjs expects.
  this.specialCases = {
    twitter: {
      setup: {
        userAuthorizationURL: "https://api.twitter.com/oauth/authorize",
      },
      varChanges: {
        clientID: 'consumerKey',
        clientSecret: 'consumerSecret'
      }
    },
    apple: {
      varAdd: {
        teamID: (settings) => {
          console.log('social auth apple teamID',settings)
        },
        keyID: (settings) => {
          console.log('social auth apple teamID',settings)
        },
        privateKeyString: (settings) => {
          console.log('social auth apple privateKeyString',settings)
        },
      },
    },
    linkedin: {
      varChanges: {
        clientID: 'consumerKey',
        clientSecret: 'consumerSecret'
      }
    },
    google: {
      varAdd: {
        returnURL: function (settings) {
          return scope.url + settings.url.callback;
        },
        realm: function (settings) {
          return scope.url + '/';
        },
      }
    },
    meetup: {
      varChanges: {
        clientID: 'consumerKey',
        clientSecret: 'consumerSecret'
      }
    },
    // tumblr: {
    //   varChanges: {
    //     clientID: 'consumerKey',
    //     clientSecret: 'consumerSecret'
    //   }
    // }
  };

  // The strategy aliases
  this.map = {
    facebook: FacebookStrategy,
    // vkontakte: VKontakteStrategy,
    twitter: TwitterStrategy,
    instagram: InstagramStrategy,
    linkedin: LinkedInStrategy,
    github: GitHubStrategy,
    google: GoogleStrategy,
    amazon: AmazonStrategy,
    foursquare: FoursquareStrategy,
    imgur: ImgurStrategy,
    meetup: MeetupStrategy,
    apple: AppleStrategy,
    // tumblr: TumblrStrategy
  };

  this.uniqueIds = {
    facebook: 'id',
    // vkontakte: 'id',
    apple: 'id',
    twitter: 'id',
    instagram: 'id',
    linkedin: 'id',
    github: 'id',
    google: 'id',
    amazon: 'id',
    foursquare: 'id',
    imgur: 'id',
    meetup: 'id',
    // tumblr: 'name'
  };

  // The strategy names
  // Some passport libs have more complex internal names than just the name of the service.
  this.strategyNameMap = {};
};

socialLoginClass.prototype.use = function (settings) {
  this.settings = settings;
  this.init();
};

socialLoginClass.prototype.init = function () {
  let scope = this;

  // Setup PassportJS
  this.app.use(scope._basePath, passport.initialize());
  if (!scope.disableSession)
    this.app.use(scope._basePath, passport.session());
  passport.serializeUser(function (user, done) {
    done(null, user);
  });
  passport.deserializeUser(function (user, done) {
    done(null, user);
  });
  if (!scope.disableSession) {
    this.app.get(this.logout.url, function (req, res) {
      res.clearCookie('session_key');
      req.logout();
      res.redirect(scope.logout.after);
    });
  }

  let type;
  for (type in this.settings) {
    this.setup(type, this.settings[type]);
  }
};
socialLoginClass.prototype.setup = function (type, settings) {
  //toolset.log("Setting up:", type);
  let scope = this;
  if (!this.map[type]) {
    toolset.error("Error!", 'type "' + type + '" is not supported.');
    return false;
  }

  // Passport setup
  let passportSetup = {
    ...((!!settings.settings && !!settings.settings.strategy && typeof settings.settings.strategy === 'object') ? settings.settings.strategy : {}),
    clientID: settings.settings.clientID,
    clientSecret: settings.settings.clientSecret,
    callbackURL: this.url + settings.url.callback,
    passReqToCallback: true


  };
  // Update the variable names if needed, because Passport is unable to standardize things apparently.
  if (this.specialCases[type] && this.specialCases[type].varChanges) {
    var varname;
    for (varname in this.specialCases[type].varChanges) {
      (function (varname) {
        // Save a copy
        var buffer = passportSetup[varname];

        // Create the new property
        passportSetup[scope.specialCases[type].varChanges[varname]] = buffer;

        /// Remove the original data
        delete passportSetup[varname];
      })(varname);
    }
  }

  // Add new non-standard variables
  if (this.specialCases[type] && this.specialCases[type].varAdd) {
    var varname;
    for (varname in this.specialCases[type].varAdd) {
      (function (varname) {
        passportSetup[varname] = scope.specialCases[type].varAdd[varname](settings);
      })(varname);
    }
  }
  // Extend the settings if needed
  if (this.specialCases[type] && this.specialCases[type].setup) {
    passportSetup = Object.assign({}, passportSetup, this.specialCases[type].setup);
  }

  // Execute the passport strategy
  //passport.use(new (this.map[type])(passportSetup, settings.methods.auth));
  passport.use(new (this.map[type])(passportSetup, function (req, accessToken, refreshToken, profile, done) {
    scope.onAuth(req, type, scope.uniqueIds[type], accessToken, refreshToken, scope.returnRaw ? profile : scope.preparseProfileData(type, profile), done);
  }));

  let strategyName = type;
  if (this.strategyNameMap[type]) {
    strategyName = this.strategyNameMap[type]
  }

  // Setup the enty point (/auth/:service)
  this.app.get(settings.url.auth, passport.authenticate(strategyName, settings.settings.authParameters || {}));

  // Setup the callback url (/auth/:service/callback)
  this.app.get(settings.url.callback, passport.authenticate(strategyName, {
    successRedirect: settings.url.success,
    failureRedirect: settings.url.fail,
    failureFlash: true,
    session: !scope.disableSession
  }));
};

// The response is not uniform, making it harder to manage consistent data format accross all the services.
//
socialLoginClass.prototype.preparseProfileData = function (type, profile) {


  let data = profile._json;

  switch (type) {
    default:
      return data;
    case "foursquare":
    case "tumblr":
      return data.response.user;
    case "imgur":
    case "instagram":
      return data.data;
    case "meetup":
      return data.results[0];
    case "google":
      return {
        id: data.sub,
        first_name: (data.given_name) ? data.given_name : data.name || "Guest",
        last_name: (data.family_name) ? data.family_name : "#",
        profile_url: data.url,
        avatar: (data.picture) ? data.picture : null,
        email: data.email,
      };
  }
};

module.exports = socialLoginClass;
