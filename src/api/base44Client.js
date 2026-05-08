/**
 * base44Client.js — reemplaza el stub de base44 con Firestore real.
 * Mantiene exactamente la misma interfaz que usaba base44 en todo el proyecto,
 * por lo que NO hay que tocar ningún otro archivo.
 *
 * Colecciones Firestore usadas (una por entidad):
 *   workoutSessions, workoutRoutines, gymRecords,
 *   financeTransactions, monthlyBudgets, savingPots, savingTransactions,
 *   investmentPositions, calendarEvents, projects, projectTasks,
 *   goals, notes
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
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Convierte un DocumentSnapshot en un objeto plano con su id */
function snap(docSnap) {
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

/** Convierte un QuerySnapshot en array de objetos planos con id */
function snapAll(querySnap) {
  return querySnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Ordena un array en JS según el string de base44 ('-date' => desc por date).
 * Firestore requiere índices compuestos para orderBy+where; hacerlo en cliente
 * es más simple y funciona bien con los límites de datos de este proyecto.
 */
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

/**
 * Crea un objeto con los métodos list / filter / create / update / delete
 * para una colección Firestore dada.
 */
function makeEntity(collectionName) {
  const col = () => collection(db, collectionName);

  return {
    /** list(orderField, maxDocs) — trae todos los documentos */
    async list(orderField, maxDocs) {
      const snap = await getDocs(col());
      let docs = snapAll(snap);
      if (orderField) docs = sortDocs(docs, orderField);
      if (maxDocs)    docs = docs.slice(0, maxDocs);
      return docs;
    },

    /** filter(fieldsObj) — filtra en cliente por los campos dados */
    async filter(fieldsObj) {
      const snap = await getDocs(col());
      let docs = snapAll(snap);
      for (const [key, val] of Object.entries(fieldsObj)) {
        docs = docs.filter(d => d[key] === val);
      }
      return docs;
    },

    /** create(data) — añade documento y devuelve el objeto con id */
    async create(data) {
      const ref = await addDoc(col(), { ...data, created_date: new Date().toISOString() });
      const newDoc = await getDoc(ref);
      return snap(newDoc);
    },

    /** update(id, data) — actualiza campos y devuelve el objeto actualizado */
    async update(id, data) {
      const ref = doc(db, collectionName, id);
      await updateDoc(ref, data);
      const updated = await getDoc(ref);
      return snap(updated);
    },

    /** delete(id) */
    async delete(id) {
      await deleteDoc(doc(db, collectionName, id));
    },
  };
}

// ─── Entidades del proyecto ────────────────────────────────────────────────────

export const base44 = {
  entities: {
    WorkoutSession:      makeEntity('workoutSessions'),
    WorkoutRoutine:      makeEntity('workoutRoutines'),
    GymRecord:           makeEntity('gymRecords'),
    FinanceTransaction:  makeEntity('financeTransactions'),
    MonthlyBudget:       makeEntity('monthlyBudgets'),
    SavingPot:           makeEntity('savingPots'),
    SavingTransaction:   makeEntity('savingTransactions'),
    InvestmentPosition:  makeEntity('investmentPositions'),
    CalendarEvent:       makeEntity('calendarEvents'),
    Project:             makeEntity('projects'),
    ProjectTask:         makeEntity('projectTasks'),
    Goal:                makeEntity('goals'),
    Note:                makeEntity('notes'),
  },

  // ─── integrations ── solo InvokeLLM se usa en FinanceInvestTab ────────────
  integrations: {
    Core: {
      /**
       * InvokeLLM — usado para buscar precios de activos financieros.
       * Se reemplaza con la API de Anthropic (Claude) via fetch.
       * Requiere que añadas VITE_ANTHROPIC_API_KEY en tu .env
       */
      async InvokeLLM({ prompt, response_json_schema }) {
        const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

        if (!apiKey) {
          console.warn('VITE_ANTHROPIC_API_KEY no definida. InvokeLLM devuelve objeto vacío.');
          return {};
        }

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            messages: [
              {
                role: 'user',
                content: `${prompt}\n\nResponde SOLO con un objeto JSON válido, sin texto adicional ni bloques de código.`,
              },
            ],
          }),
        });

        const data = await res.json();
        const text = data?.content?.[0]?.text ?? '{}';
        try {
          return JSON.parse(text.replace(/```json|```/g, '').trim());
        } catch {
          return {};
        }
      },

      // Los demás no se usan en el proyecto; los dejamos como no-ops
      SendEmail:                   async () => {},
      SendSMS:                     async () => {},
      UploadFile:                  async () => {},
      GenerateImage:               async () => {},
      ExtractDataFromUploadedFile: async () => {},
    },
  },
};
