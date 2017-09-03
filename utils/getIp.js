/**
 * Created by Maxime Baconnais on 03/09/2017.
 */

const getIp = (req) => {
	
	return (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress);
}

module.exports = getIp;