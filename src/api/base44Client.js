/**
 * base44Client.js
 * FIX: db se resuelve en cada llamada (no en el momento de importación del módulo)
 * para evitar el error TDZ "Cannot access X before initialization" en el bundle
 * de producción, donde Rollup puede ejecutar este módulo antes de que firebase.js
 * haya exportado db.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

// db se importa de forma lazy para evitar el TDZ en producción
function getDb() {
  // La importación dinámica síncrona no existe, así que resolvemos db
  // mediante un getter que siempre lee del módulo ya inicializado.
  // Como firebase.js es puro (no circular), esto es seguro.
  return import('./firebase').then(m => m.db);
}

// Versión síncrona: se usa dentro de async functions, así que
// simplificamos cacheando db la primera vez que se llame.
let _db = null;
async function db() {
  if (_db) return _db;
  const m = await import('./firebase');
  _db = m.db;
  return _db;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function snap(docSnap) {
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

function snapAll(querySnap) {
  return querySnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function sortDocs(docs, orderStr) {
  if (!orderStr) return docs;
  const desc = orderStr.startsWith('-');
  const field = desc ? orderStr.slice(1) : orderStr;
  return [...docs].sort((a, b) => {
    const av = a[field] ?? '';
    const bv = b[field] ?? '';
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

function makeEntity(collectionName) {
  return {
    async list(orderField, maxDocs) {
      const database = await db();
      const s = await getDocs(collection(database, collectionName));
      let docs = snapAll(s);
      if (orderField) docs = sortDocs(docs, orderField);
      if (maxDocs)    docs = docs.slice(0, maxDocs);
      return docs;
    },

    async filter(fieldsObj) {
      const database = await db();
      const s = await getDocs(collection(database, collectionName));
      let docs = snapAll(s);
      for (const [key, val] of Object.entries(fieldsObj)) {
        docs = docs.filter(d => d[key] === val);
      }
      return docs;
    },

    async create(data) {
      const database = await db();
      const ref = await addDoc(collection(database, collectionName), {
        ...data,
        created_date: new Date().toISOString(),
      });
      const newDoc = await getDoc(ref);
      return snap(newDoc);
    },

    async update(id, data) {
      const database = await db();
      const ref = doc(database, collectionName, id);
      await updateDoc(ref, data);
      const updated = await getDoc(ref);
      return snap(updated);
    },

    async delete(id) {
      const database = await db();
      await deleteDoc(doc(database, collectionName, id));
    },
  };
}

// ─── Entidades ─────────────────────────────────────────────────────────────────

export const base44 = {
  entities: {
    WorkoutSession:     makeEntity('workoutSessions'),
    WorkoutRoutine:     makeEntity('workoutRoutines'),
    GymRecord:          makeEntity('gymRecords'),
    FinanceTransaction: makeEntity('financeTransactions'),
    MonthlyBudget:      makeEntity('monthlyBudgets'),
    SavingPot:          makeEntity('savingPots'),
    SavingTransaction:  makeEntity('savingTransactions'),
    InvestmentPosition: makeEntity('investmentPositions'),
    CalendarEvent:      makeEntity('calendarEvents'),
    Project:            makeEntity('projects'),
    ProjectTask:        makeEntity('projectTasks'),
    Goal:               makeEntity('goals'),
    Note:               makeEntity('notes'),
    InvestmentSale:     makeEntity('investmentSales'),
    InvestmentAccount:  makeEntity('investmentAccounts'),
  },

  appLogs: {
    logUserInApp: async () => {},
  },

  auth: {
    // stub para PageNotFound que lo referencia
    me: async () => { throw new Error('not implemented'); },
  },

  integrations: {
    Core: {
      async InvokeLLM({ prompt }) {
        const apiKey = import.meta.env.VITE_GROQ_API_KEY;
        if (!apiKey) return {};
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              max_tokens: 512,
              temperature: 0.2,
              messages: [{
                role: 'user',
                content: `${prompt}\n\nResponde SOLO con un objeto JSON válido, sin texto adicional ni bloques de código.`,
              }],
            }),
          });
          const data = await res.json();
          const text = data?.choices?.[0]?.message?.content ?? '{}';
          return JSON.parse(text.replace(/```json|```/g, '').trim());
        } catch {
          return {};
        }
      },

      SendEmail:                   async () => {},
      SendSMS:                     async () => {},
      UploadFile:                  async () => {},
      GenerateImage:               async () => {},
      ExtractDataFromUploadedFile: async () => {},
    },
  },
};
