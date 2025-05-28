const { app, initializeApp } = require('./src/app');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await initializeApp();
  
  app.listen(PORT, () => {
    console.log(`🚀 Subscription API running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  });
};

startServer().catch(console.error);
