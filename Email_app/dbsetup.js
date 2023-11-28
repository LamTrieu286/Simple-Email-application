const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
})
const upload = multer({ storage: storage });
const app = express();

const mysql = require('mysql2');
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'wpr',
  password: 'fit2023',
  database: 'wpr2023',
  port: 3306
});

connection.connect((err) => {
  if (err) throw err;
});

app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());
app.use(cookieParser());

app.set('view engine', 'ejs');

const setupDatabase = async () => {

  await connection.promise().query("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT, email VARCHAR(255), password VARCHAR(255), fullname VARCHAR(255), PRIMARY KEY(id))");

  await connection.promise().query("CREATE TABLE IF NOT EXISTS emails (id INT AUTO_INCREMENT, senderId INT, receiverId INT, subject VARCHAR(255), body TEXT,attachment VARCHAR(255), timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id))");

connection.query('SELECT COUNT(*) as count FROM users', (err, results) => {
  if (err) throw err;
  if (results[0].count === 0) {
    connection.query("INSERT INTO users (email, password, fullname) VALUES ('a@a.com', 'password1', 'Nguyen Van A'), ('b@b.com', 'password2', 'Trieu Thanh B'), ('c@c.com', 'password3', 'Cao THai C')", (err, result) => {
      if (err) throw err;
    });
  }
});

connection.query('SELECT COUNT(*) as count FROM emails', (err, results) => {
  if (err) throw err;
  if (results[0].count === 0) {
    connection.query("INSERT INTO emails (senderId, receiverId, subject, body) VALUES (1, 2, 'Hello', 'How are you?'), (1, 3, 'Hello', 'How are you?'), (2, 1, 'Re: Hello', 'I am fine. How about you?'), (3, 1, 'Re: Hello', 'I am fine. How about you?'), (2, 3, 'Hello', 'How are you?'), (3, 2, 'Re: Hello', 'I am fine. How about you?'), (1, 2, 'Hello again', 'How are you doing?'), (1, 3, 'Hello again', 'How are you doing?')", (err, result) => {
      if (err) throw err;
    });
  }
});
};
setupDatabase();


app.get('/', function(request, response) {
  response.render('SignIn.ejs', { title: 'Sign In' });
});

app.post('/signin', function(request, response) {
  const email = request.body.email;
  const password = request.body.password;
  if (email && password) {
    connection.query('SELECT * FROM Users WHERE email = ? AND password = ?', [email, password], function(error, results, fields) {
      if (error) {
        console.error('Error with query:', error);
        response.status(500).send('Server error');
        return;
      }
      if (!results) {
        console.error('No results from query');
        response.status(500).send('Server error');
        return;
      }
      if (results.length > 0) {
        response.cookie('userId', results[0].id);
        console.log(userId);
        response.redirect('/inbox');
      } else {
        response.render('SignIn.ejs', { title: 'Sign In', message: 'Incorrect email or password' });
      }
      response.end();
    });
  } else {
    response.render('SignIn.ejs', { title: 'Sign In', message: 'Please enter email and password' });
    response.end();
  }
});


app.get('/signup', function(request, response) {
  response.render('SignUp.ejs', { title: 'Sign Up' });
});

app.post('/signup', function(request, response) {
  const email = request.body.email;
  const password = request.body.password;
  const fullname = request.body.name;
  if (email && password && fullname) {
    connection.query('SELECT * FROM Users WHERE email = ?', [email], function(error, results, fields) {
      if (error) {
        console.error('Error with query:', error);
        response.status(500).send('Server error');
        return;
      }
      if (results.length > 0) {
        response.render('SignUp.ejs', { title: 'Sign Up', message: 'Email address is already used', messageType: 'error' });
      } else {
        connection.query('INSERT INTO Users (email, password, fullname) VALUES (?, ?, ?)', [email, password, fullname], function(error, results, fields) {
          if (error) {
            console.error('Error with query:', error);
            response.status(500).send('Server error');
            return;
          }
          response.render('Success.ejs', { title: 'Sign Up Successful', message: 'Welcome ' + fullname + '! You can now sign in.', signinLink: '/signin' });
        });
      }
    });
  } else {
    response.render('SignUp.ejs', { title: 'Sign Up', message: 'Please enter email, password and fullname', messageType: 'error' });
  }
});




app.get('/inbox', async (req, res) => {
  let page = Math.max(1, parseInt(req.query.page) || 1);
  let perPage = 5;
  let offset = (page - 1) * perPage;
  let userId = req.cookies.userId;
  connection.query('SELECT COUNT(*) as count FROM emails WHERE receiverId = ?', [userId], (err, results) => {
      if (err) throw err;
      let totalCount = results[0].count;
      let pageCount = Math.ceil(totalCount / perPage);
      connection.query('SELECT emails.*, users.fullname as senderName FROM emails JOIN users ON users.id = emails.senderId WHERE emails.receiverId = ? ORDER BY timestamp DESC LIMIT ?, ?', [userId, offset, perPage], (err, results) => {
        if (err) throw err;
        res.render('layout', { title: 'Inbox', body: 'inboxBody', emails: results, pageCount: pageCount, page: page });
    });
  });
});


app.post('/api/delete', function(request, response) {
  const emailIds = request.body.emailIds;
  if (emailIds && emailIds.length > 0) {
    const query = 'DELETE FROM emails WHERE id IN (?)';
    connection.query(query, [emailIds], function(error, results) {
      if (error) {
        console.error('Error with query:', error);
        response.status(500).send('Server error');
        return;
      }
      response.send('Emails deleted');
    });
  } else {
    response.status(400).send('No emails selected');
  }
});

app.get('/compose', async function(request, response) {
  const [users] = await connection.promise().query('SELECT * FROM Users');
  response.render('Layout.ejs', { title: 'Compose', body: 'composeBody', users: users });
});


app.post('/compose', upload.single('attachment'), function(request, response) {
  const recipientId = request.body.recipient;
  const subject = request.body.subject || '(no subject)';
  const body = request.body.body || '';
  const attachment = request.file ? request.file.path : null;
  const userId = request.cookies.userId; // Get the user ID from the cookie
  if (recipientId) {
    connection.query('INSERT INTO emails (senderId, receiverId, subject, body, attachment) VALUES (?, ?, ?, ?, ?)', [userId, recipientId, subject, body, attachment], function(error, results) {
      if (error) {
        console.error('Error with query:', error);
        response.status(500).send('Server error');
        return;
      }
      response.render('Sended.ejs', { title: 'Email Sent', message: 'Your email has been sent.' });
    });
  } else {
    response.render('Compose.ejs', { title: 'Compose', users: users, message: 'Recipient must be selected' });
  }
});


app.get('/outbox', async (req, res) => {
  let page = Math.max(1, parseInt(req.query.page) || 1);
  let perPage = 5;
  let offset = (page - 1) * perPage;
  let userId = req.cookies.userId;
  connection.query('SELECT COUNT(*) as count FROM emails WHERE senderId = ?', [userId], (err, results) => {
      if (err) throw err;
      let totalCount = results[0].count;
      let pageCount = Math.ceil(totalCount / perPage);
      connection.query('SELECT emails.*, users.fullname as receiverName FROM emails JOIN users ON users.id = emails.receiverId WHERE emails.senderId = ? ORDER BY timestamp DESC LIMIT ?, ?', [userId, offset, perPage], (err, results) => {
        if (err) throw err;
        res.render('layout', { title: 'Outbox', body: 'outboxBody', emails: results, pageCount: pageCount, page: page });
    });
  });
});


app.get('/email/:id', async (req, res) => {
  let emailId = req.params.id;
  connection.query('SELECT emails.*, users.fullname AS senderName FROM emails JOIN users ON emails.senderId = users.id WHERE emails.id = ?', [emailId], (err, results) => {
      if (err) throw err;
      let email = results[0];
      res.render('email', { email: email });
  });
});



app.get('/email/uploads/:file', (req, res) => {
    let file = req.params.file;
    let fileLocation = path.join('./uploads', file);
    res.download(fileLocation, (err) => {
        if (err) {
            res.status(500).send({
                message: "Could not download the file. " + err,
            });
        }
    });
});

app.get('/signout', function(request, response) {
  response.clearCookie('session');
  response.redirect('/');
});

app.listen(8000, () => console.log('Server started on port 8000'));

