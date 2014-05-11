var http = require("http");
var https = require("https");
var express = require('express');
var bodyParser = require('body-parser')
var app = express();
var engine = require('ejs-locals')

var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , mongodb = require('mongodb')
  , mongoose = require('mongoose')
  , bcrypt = require('bcrypt')
  , SALT_WORK_FACTOR = 10;



mongoose.connect('localhost', 'meals');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
  console.log('Connected to DB');
});

var planSchema = mongoose.Schema({
    entry: {type: Number, required: true},
    week: {type: Number, required: true},
    user: {type: String, required: true},
    uri: {type: String, required: false},
    yield: {type: Number, required: true},
    calories: {type: Number, required: true},
    healthLabels: {type: [String], required: false},
    dietLabels: {type: [String], required: false},
    cautions: {type: [String], required: false},
    title: {type: String, required: true},
    ingr: {type: [String],required: true},
    img: {type: String, required: true},
    recipe: {type: String, required: true},
    rid: {type: String, required: true}
});

var userSchema = mongoose.Schema({
  email: {type: String, required: true, unique: true },
  password: {type: String, required: true},
  lastWeek: {type: Number, required: false}
});

userSchema.methods.comparePassword = function(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    });
};

userSchema.pre('save', function(next) {
    var user = this;

    if (!user.isModified('password')) return next();

    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if (err) return next(err);

        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err);
            user.password = hash;
            next();
        });
    });
});

var User = mongoose.model('User', userSchema);
var Plan = mongoose.model('Plan', planSchema);

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, function(email, password, done) {
    User.findOne({
        email: email
    }, function(err, user) {
        if (err) {
            return done(err);
        }
        if (!user) {
            return done(null, false, {
                message: 'Unknown user ' + email
            });
        }
        user.comparePassword(password, function(err, isMatch) {
            if (err) return done(err);
            if (isMatch) {
                return done(null, user);
            } else {
                return done(null, false, {
                    message: 'Invalid password'
                });
            }
        });
    });
}));

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login')
}



app.use(express.static(process.cwd() + '/public'));
app.engine('ejs', engine);
app.use(bodyParser());
app.use(express.cookieParser('keyboard cat'));
app.use(express.session({
    secret: "my secret"
}));
app.use(express.methodOverride());
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.set('view engine', 'ejs');


function search(query, fn) {
    http.request({
        host: 'food2fork.com',
        path: '/api/search?key=5d440b0adf35ec65c6c847f1b250c0dc&q=' + query,
        method: 'GET'
    }, function(res) {
        res.setEncoding('utf8');
        var body = '';
        res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            body = JSON.parse(body);
            fn(body['recipes']);
        })
    }).end();
}

function getReceipe(rId, fn) {
    http.request({
        host: 'food2fork.com',
        path: '/api/get?key=5d440b0adf35ec65c6c847f1b250c0dc&rId=' + rId,
        method: 'GET'
    }, function(res) {
        res.setEncoding('utf8');
        var body = '';
        res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            body = JSON.parse(body);
            fn(body['recipe']);
        })
    }).end();
}

function nutrition(data, fn) {
    var req = https.request({
        host: 'api.edamam.com',
        path: '/api/nutrient-info?extractOnly&app_id=0ab6e900&app_key=440e24a9f75eae2c0dd9933ba05c97f9',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }, function(res) {
        res.setEncoding('utf8');
        var body = '';
        res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            body = JSON.parse(body);
            fn(body);
        })
    });

    req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
    });

    req.write(JSON.stringify(data));
    req.end();
}



/*getReceipe('35382', function(res) {
    var query = {};
    query['title'] = res['title'];
    query['ingr'] = res['ingredients'];
    nutrition(query, function(response) {
        response['title'] = query['title'];
        response['ingr'] = query['ingr'];
        response['img'] = res['image_url'];
        response['recipe'] = res['source_url'];
        console.log(response);
    });
});*/



app.get('/', function(req, res) {
    res.render('index', {user: req.user});
});

app.get('/plan/:week', ensureAuthenticated, function(req,res){
    Plan.find({week: req.params.week, user: req.user.id}, function(err, data){
        for (var i = 0; i < data.length; i++) {
            data[i]['_id']= '"'+data[i]['_id'].toString()+'"';
        };
        res.render('plan', {user: req.user, week: req.params.week, data:JSON.stringify(data)});
    });    
});

app.get('/login', function(req, res) {
    res.render('login');
});

app.get('/register', function(req, res){
    res.render('register');
});

app.post('/login', function(req, res, next){
    passport.authenticate('local', function(err, user, info) {
        console.log(user);
        if (err) {
            return next(err)
        }
        if (!user) {
            console.log(info.message);
            req.session.messages = [info.message];
            return res.redirect('/login')
        }
        req.logIn(user, function(err) {
            if (err) {
                return next(err);
            }
            return res.redirect('/');
        });
    })(req, res, next);
});

app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

app.post('/register', function(req, res){
    var user = new User(req.body);
    user.save(function(err) {
        if (err) {
            console.log(err);
        } else {
            console.log('user: ' + user.email + " saved.");
            res.redirect('/');
        }
    });
});

app.get('/api/search/:query', function(req, res) {
    search(req.params.query, function(response) {
        res.json(response);
    });
});

app.get('/api/info/:id', function(req, res){
	getReceipe(req.params.id, function(r) {
	    var query = {};
	    query['title'] = r['title'];
	    query['ingr'] = r['ingredients'];
	    nutrition(query, function(response) {
	        response['title'] = query['title'];
	        response['ingr'] = query['ingr'];
	        response['img'] = r['image_url'];
	        response['recipe'] = r['source_url'];
	        response['rid'] = r['recipe_id'];
	        res.json(response);
	    });
	});
});

app.get('/api/plan/:week', ensureAuthenticated, function(req, res){
    Plan.find({week: req.params.week, user: req.user.id}, function(err, data){
        res.json(data);
    });
});

app.post('/api/add', function(req, res){
    var plan = new Plan(req.body);

    plan.save(function(err){
        if(!err)
            res.json(plan);
        else
            console.log(err);
    });
});

app.post('/api/remove', function(req, res){
    Plan.remove({_id:req.body.id}, function(err){
        if(!err)
            console.log('Removed!');
        else
            console.log(err);
    });
});


var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
})