const WebSocketServer = require('websocket').server;
const websocketPort = 3333;
//const mysql = require('mysql');
//const mysql_creds = require('./mysqlcreds.js');
//const db = mysql.createConnection( mysql_creds );
const http = require('http');
 
const server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(websocketPort, function() {
    console.log((new Date()) + ' Server is listening on port 3333');
});
 
const wsServer = new WebSocketServer({
    httpServer: server,
    //autoAcceptConnections: true
});


 
function originIsAllowed(origin) {
  return true;
}

function joinRoom(connection, roomID){
	if(rooms[roomID]){
		rooms[roomID].listeners.push(connection);
		const currentChatCon = chatConnections.get(connection);
		currentChatCon.room = rooms[roomID];
		sendMessageToRoom(currentChatCon.name + ' has joined the room', connection);	
		sendActionToPerson('roomjoin', connection, { 
			message: `you have joined the ${currentChatCon.room.name}`,
			roomName: currentChatCon.room.name,
			participants: currentChatCon.room.listeners.map( conn => chatConnections.get(conn).name),
			messages: currentChatCon.room.messages,
		});
	}
}
function leaveRoom(connection, room, leavingServer=false){
	console.log('removing user from room');
	console.log('room id ', room.name);
	if(room){
		const listenerIndex = room.listeners.indexOf(connection);
		room.listeners.splice(listenerIndex, 1);
		const currentChatCon = chatConnections.get(connection);
		const leftRoomName = currentChatCon.room.name
		
		sendMessageToRoom(leftRoomName + ' has left the ' + leavingServer ? 'server' : 'room', connection, false);	
		if(!leavingServer){
			sendActionToPerson('roomleave', connection, { 
				message: `you have left the ${leftRoomName}`,
			});
		}
		currentChatCon.room = null;
		

	}	
}
function removeConnections(connection){
	const receiverCon = chatConnections.get(connection);
	const roomID = receiverCon.room;
	console.log('removing user from server');
	leaveRoom(connection, roomID, true);
	chatConnections.delete(connection);
	console.log('current connections: '+chatConnections.size);
}
function addConnection(connection, data){
	console.log('addding connection with data: ', data.message)
	chatConnections.set(connection, {
		conn: connection,
		name: data.message.username, 
		room: null
	});
	sendActionToPerson('join', connection, {message: 'you have joined the server'});
}
function sendActionToPerson(action, recipientConnection, extraData={}){
	recipientConnection.send( createPacket(action, systemTitle, extraData))	
}
const systemTitle = "SYSTEM";
function sendMessageToPerson(message, destinationConnection, sourceConnection=null){
	const receiverCon = chatConnections.get(destinationConnection);
	let senderName = '';
	if(sourceConnection!==null){
		let senderCon = chatConnections.get(sourceConnection);
		senderName = senderCon.name
	}
	receiverCon.send(createPacket('message', senderName, message));
}
function sendMessageToRoom(message, connection, excludeSender=true){
	console.log('sending message to entire room : ' + message);
	const currentChatCon = chatConnections.get(connection);
	let currentRoom = currentChatCon.room;
	const participants = currentRoom.listeners.slice();
	if(excludeSender){
		participants.splice( participants.indexOf(connection),1);
	}
	participants.forEach( listener => listener.send(createPacket('message',systemTitle, message)))
}
function createPacket(type, sender, data){
	return JSON.stringify({ action: type, sender, data});
}
const rooms = {
	lobby: { name: 'lobby', listeners: [], messages: [
		{sender: 'SERVER', message:'play nice!'},
		{sender: 'SERVER', message:'this means you!'}
	]}
}
const chatConnections = new Map();

wsServer.on('request', function(request) {
	console.log('test');
    // if (!originIsAllowed(request.origin)) {
    //   // Make sure we only accept requests from an allowed origin
    //   request.reject();
    //   console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
    //   return;
    // }
    const connection = request.accept(null, request.origin);
    console.log((new Date()) + ' Connection accepted.');
    connection.on('message', function(message) {
	    console.log('Received Message: ' + message.utf8Data);
	    //connection.sendUTF(message.utf8Data);
	    const data = JSON.parse(message.utf8Data)
	    switch(data.action){
	    	case 'createaccount':
	    		console.log('create account');
	    		break;
	    	case 'join':
	    		console.log('account login');
	    		addConnection(connection, data);
	    		joinRoom(connection, 'lobby')
	    		break;
	    	case 'createroom':
	    		console.log('create room');
	    		break;
	    	case 'joinroom':
	    		console.log('join room');
	    		break;
	    	case 'sendmessage':
	    		console.log('send message');
	    		break;
	    }
    });
    connection.on('close', function(reasonCode, description) {
    	removeConnections(connection);
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});

