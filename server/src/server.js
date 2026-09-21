import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/database.js';

const port = Number(process.env.PORT || 5000);

connectDatabase()
  .then(() => app.listen(port, () => console.log(`API ready at http://localhost:${port}`)))
  .catch((error) => {
    console.error('Unable to connect to MongoDB', error);
    process.exit(1);
  });
