export const base44 = {
  auth: {
    me: async () => ({ id: "1", email: "yo@firebase.com", name: "Usuario" }),
    logout: async () => {},
    updateMe: async () => {}
  },
  entities: {
    Query: () => ({ 
      execute: async () => [],
      eq: function() { return this; },
      order: function() { return this; },
      limit: function() { return this; }
    }),
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => ({})
  },
  integrations: {
    Core: {
      SendEmail: async () => {}
    }
  }
};
