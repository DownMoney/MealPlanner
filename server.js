var http = require("http");
var https = require("https");
var express = require('express');
var bodyParser = require('body-parser')
var app = express();
var engine = require('ejs-locals')

app.use(express.static(process.cwd() + '/public'));
app.engine('ejs', engine);
app.use(bodyParser());




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
    res.render('index');
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



var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
})