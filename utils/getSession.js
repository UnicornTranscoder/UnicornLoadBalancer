/**
 * Created by Maxime Baconnais on 02/09/2017.
 */

let getSession = (req) => {
	
	let sessionId = false;
	if (typeof(req.params.sessionId) !== 'undefined')
		sessionId = req.params.sessionId;
	else if (typeof(req.query.session) !== 'undefined')
		sessionId = req.query.session;
	else if (typeof(req.query['X-Plex-Session-Identifier']) !== 'undefined')
		sessionId = req.query['X-Plex-Session-Identifier'];
	return (sessionId);
}