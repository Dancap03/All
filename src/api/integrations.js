// Lazy getters para evitar el error "Cannot access X before initialization"
// en el bundle de producción (Vite/Rollup reordena módulos al minificar).

import { base44 } from './base44Client';

export function getCore() { return base44.integrations.Core; }

export const InvokeLLM                   = (...args) => base44.integrations.Core.InvokeLLM(...args);
export const SendEmail                   = (...args) => base44.integrations.Core.SendEmail(...args);
export const SendSMS                     = (...args) => base44.integrations.Core.SendSMS(...args);
export const UploadFile                  = (...args) => base44.integrations.Core.UploadFile(...args);
export const GenerateImage               = (...args) => base44.integrations.Core.GenerateImage(...args);
export const ExtractDataFromUploadedFile = (...args) => base44.integrations.Core.ExtractDataFromUploadedFile(...args);

// Compatibilidad: Core como objeto con los mismos métodos
export const Core = {
  get InvokeLLM()                   { return base44.integrations.Core.InvokeLLM; },
  get SendEmail()                   { return base44.integrations.Core.SendEmail; },
  get SendSMS()                     { return base44.integrations.Core.SendSMS; },
  get UploadFile()                  { return base44.integrations.Core.UploadFile; },
  get GenerateImage()               { return base44.integrations.Core.GenerateImage; },
  get ExtractDataFromUploadedFile() { return base44.integrations.Core.ExtractDataFromUploadedFile; },
};
