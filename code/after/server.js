var http = require('http');

//creating a server that will receive all incoming requests
var application = http.createServer(function (request, response) {  
    var body = '';
     //receive the data stream
    request.on('data', function (data) {         
        body += data;
    });
    //finished receiving the data stream now we can process the request
    request.on('end', function () {         
         //we're only catering for JSON data (but you may extend to allow for other types)
        request.body = body ? JSON.parse(body) : body;
        //we use this function to test the pattern against an incoming url
        var partsTest = function (patternParts, urlParts) {
            var match = true;
            for (var i = 0; i < patternParts.length; i++) {
                if (patternParts[i][0] !== ':' && patternParts[i] !== urlParts[i]) {
                    match = false;
                }
            }
            return match;
        };
        //we use this function to set parameters values embedded on the incoming url
        var setRequestParameters = function (patternParts, urlParts, request) {
            request.params = request.params || {};
            for (var i = 0; i < patternParts.length; i++) {
                if (patternParts[i][0] === ':') {
                    request.params[patternParts[i].replace(':', '')] = urlParts[i].replace(/%20/g, ' '); //replace encoding values (%20) with a space
                }
            }
        };
        //here we are looking for handlers collection based on the http verb received (e.g. getHandlers or postHandlers)
        var handlers = application[request.method.toLocaleLowerCase() + 'Handlers'];
        if (handlers) {
            //trying to match an incoming url request to an appropriate handler
            var urlParts = request.url.split('/').filter(function (e) { return e; });
            var bestHandlers = handlers.filter(function (h) {
                var patternParts = h.pattern.split('/')
                    .filter(function (e) { return e; });
                return patternParts.length === urlParts.length && partsTest(patternParts, urlParts);
            });
            if (bestHandlers.length === 0) {
                response.statusCode = 400;
                response.end('No suitable handler found for the request');
            }
            else {
                var actualHandler = bestHandlers[0];
                setRequestParameters(actualHandler.pattern
                    .split('/')
                    .filter(function (e) { return e; }),
                    urlParts,
                    request);
                actualHandler.handler.call(this, request, response); // once a handler is found we'll invoke it passing the request and response objects 
            }
        }
        else {
            response.statusCode = 400;
            response.end('No suitable handler found for the request');
        }
    });
});

//creating a get function to register getHandlers (pattern and handler) on the application
application.get = function (pattern, handler) {
    application.getHandlers = application.getHandlers || [];
    application.getHandlers.push({
        pattern: pattern,
        handler: handler
    });
};

//creating a post function to register getHandlers (pattern and handler) on the application
application.post = function (pattern, handler) {
    application.postHandlers = application.postHandlers || [];
    application.postHandlers.push({
        pattern: pattern,
        handler: handler
    });
};

application.get('/', function (request, response) {
    response.statusCode = 200;
    response.end('API is ready to receive requests');
});

var topics;
application.get('/api/topics', function (request, response) {
    topics = topics || require('./topics.json');
    response.writeHead(200, { 'Content-Type': 'application/json' });
    var protocol = request.connection.encrypted ? 'https' : 'http';
    response.end(JSON.stringify(topics.map(function (topic) {
        return {
            id: topic.id,
            topic: topic.topic,
            url: protocol + '://' + request.headers['host'] + '/api/topic/' + topic.id
        }
    })));
});

application.get('/api/topic/:id', function (request, response) {
    var id = parseInt(request.params.id);
    if (!Number.isInteger(id)) {
        response.statusCode = 500;
        response.end('Bad data received: expected a topic id but was not found');
        return;
    }
    topics = topics || require('./topics.json');
    var results = topics.filter(function (data) {
        return data.id === id;
    });
    if (results.length === 0) {
        response.statusCode = 404;
        response.end('There was no topic found for id: ' + id);
        return;
    }
    var topic = results[0];
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(topic));
});

application.get('/api/topic/:id/:name', function (request, response) {
    var id = parseInt(request.params.id);
    if (!Number.isInteger(id)) {
        response.statusCode = 500;
        response.end('Bad data received: expected a topic id but was not found');
        return;
    }
    topics = topics || require('./topics.json');
    var results = topics.filter(function (data) {
        return data.id === id;
    });
    if (results.length === 0) {
        response.statusCode = 404;
        response.end('There was no topic found for id: ' + id);
        return;
    }

    var topic = results[0];
    var name = request.params.name;

    results = topic.tutorials.filter(function (data) {
        return data.name === name;
    });

    if (results.length === 0) {
        response.statusCode = 404;
        response.end('There was no tutorial found with the name: ' + name);
        return;
    }

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
        id: topic.id,
        topic: topic.topic,
        tutorials: results
    }));
});

application.post('/api/topic', function (request, response) {
    topics = topics || require('./topics.json');
    var topic = request.body;
    var results = topics.filter(function (t) {
        return t.topic === topic.topic;
    });

    if (results.length > 0) {
        response.statusCode = 400;
        response.end('Cannot add a topic that already exists');
        return;
    }

    topic.id = topics.length + 1;
    //Data must obviously be validated before being persisted	
    topics.push(topic);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    var protocol = request.connection.encrypted ? 'https' : 'http';
    response.end(JSON.stringify({
        id: topic.id,
        url: protocol + '://' + request.headers['host'] + '/api/topic/' + topic.id
    }));
});

var port = 8989;
application.listen(port, function () {
    console.log('APPLICATION IS LISTENING ON PORT: ' + port);
});
