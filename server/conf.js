module.exports = {
    mongoUrl : process.env.MONGOHQ_URL || 'mongodb://R:billion@alex.mongohq.com:10053/app6520692',
    
    facebook: {
        appId: '509552485736388'
      , appSecret: 'f4f302039147fae5d118b42d2a6a0205'
    }
  , twit: {
        consumerKey: ''
      , consumerSecret: ''
    }
  , github: {
        appId: ''
      , appSecret: ''
    }
  , instagram: {
        clientId: '18a1750a97dd4ecda61a49b08296639e'
      , clientSecret: 'b5801a956aa24e308a00f3e985dfe1e8'
    }
  , foursquare: {
        clientId: ''
      , clientSecret: ''
    }
  , google: {
        clientId: '224794776836-cp3a2v0elt955h9uqhgmskplhg85ljjm.apps.googleusercontent.com'
      , clientSecret: 'rxGFo1mBG_H3DX2ifDFawiMZ'
    }
  , dropbox: {
      consumerKey : '430zvvgwfjxnj4v',
      consumerSecret : 'un2e5d75rkfdeml'
  },
  flickr: {
    consumerKey : '246152862e1891230c664f9ef1c7e5f6',
    consumerSecret : 'b970658338c81152'
  },
  aws: {
    key: process.env.AWS_ACCESS_KEY_ID || 'AKIAJETT3QLQHO6ZZTZA',
    secret: process.env.AWS_SECRET_ACCESS_KEY || '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',
    bucket: process.env.AWS_S3_BUCKET || 'heroku-photos-1',
    datacenterUrl: 'http://heroku-photos-1.s3-website-us-east-1.amazonaws.com'
  },
  dbox:
  { "app_key": "430zvvgwfjxnj4v", "app_secret": "un2e5d75rkfdeml", root : 'dropbox'}
};