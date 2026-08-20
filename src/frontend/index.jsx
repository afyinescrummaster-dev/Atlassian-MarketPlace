import React, { useEffect, useState } from "react";
import ForgeReconciler, { Stack, Text } from "@forge/react";
import { invoke } from "@forge/bridge";

const App = () => {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    invoke("getText")
      .then(setMessage)
      .catch(() => setMessage("Hello World!"));
  }, []);

  return (
    <Stack space="space.100">
      <Text>{message}</Text>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);