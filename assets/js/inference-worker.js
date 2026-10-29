/** Le calcul du playground reste hors du fil de l'interface, même sur mobile. */
import { forward } from './gpt.js';
let model;
self.onmessage = ({data}) => {
  try {
    if (data.model) model = data.model;
    const result = forward(model, data.ids);
    self.postMessage({logits: result.logits.at(-1), attention: result.attention});
  } catch {
    self.postMessage({error: 'Le calcul du modèle a échoué.'});
  }
};
