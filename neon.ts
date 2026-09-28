import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Kein Neon Auth: das Quiz nutzt nur eine Person, der Zugang laeuft ueber ein
  // Geraetetoken, das die Function selbst prueft.
  auth: false,

  functions: {
    // Slug: ^[a-z0-9]{1,20}$ — steht dauerhaft in der Aufruf-URL und laesst sich
    // nach dem ersten Deploy nicht mehr aendern.
    sync: {
      name: "Lernstand Sync",
      source: "./functions/sync.ts",
      env: {
        // Wird aus der Datei gelesen, die `neon deploy --env <datei>` uebergibt.
        // Steht bewusst nicht im Repository.
        LERNSTAND_TOKEN: process.env.LERNSTAND_TOKEN!,
      },
    },
  },

  branch: (branch) => {
    if (branch.isDefault) {
      return {};
    }
    if (!branch.exists) {
      // Neue Nebenzweige raeumen sich nach einer Woche selbst auf.
      return { ttl: "7d" };
    }
    return {};
  },
});
