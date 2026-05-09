/**
 * base44Client.js
 * Reemplaza base44 con Firebase Firestore manteniendo la misma interfaz:
 *   base44.entities.X.list(order, limit)
 *   base44.entities.X.filter({ campo: valor })
 *   base44.entities.X.create(data)
 *   base44.entities.X.update(id, data)
 *   base44.entities.X.delete(id)
 *   base44.integrations.Core.InvokeLLM({ prompt })
 */

import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

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
  const col = () => collection(db, collectionName);

  return {
    async list(orderField, maxDocs) {
      const s = await getDocs(col());
      let docs = snapAll(s);
      if (orderField) docs = sortDocs(docs, orderField);
      if (maxDocs)    docs = docs.slice(0, maxDocs);
      return docs;
    },

    async filter(fieldsObj) {
      const s = await getDocs(col());
      let docs = snapAll(s);
      for (const [key, val] of Object.entries(fieldsObj)) {
        docs = docs.filter(d => d[key] === val);
      }
      return docs;
    },

    async create(data) {
      const ref = await addDoc(col(), {
        ...data,
        created_date: new Date().toISOString(),
      });
      const newDoc = await getDoc(ref);
      return snap(newDoc);
    },

    async update(id, data) {
      const ref = doc(db, collectionName, id);
      await updateDoc(ref, data);
      const updated = await getDoc(ref);
      return snap(updated);
    },

    async delete(id) {
      await deleteDoc(doc(db, collectionName, id));
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
  },

  // stub para que no rompa si algo lo referencia
  appLogs: {
    logUserInApp: async () => {},
  },

  integrations: {
    Core: {
      // InvokeLLM se usa en FinanceInvestTab para buscar precios.
      // Si no tienes VITE_ANTHROPIC_API_KEY en el .env simplemente devuelve {}.
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
