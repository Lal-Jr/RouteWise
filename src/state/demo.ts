import type { Trip } from '../core/types'

const h = (hh: number, mm = 0) => hh * 60 + mm

/** A walking day in Paris that deliberately doesn't quite fit, to show dropping and repair. */
export const demoTrip: Trip = {
  start: { id: 'start', name: 'Hôtel de Ville', lat: 48.8566, lng: 2.3522 },
  end: null,
  returnToStart: true,
  dayStart: h(8, 30),
  dayEnd: h(21),
  mode: 'walking',
  bufferMin: 5,
  stops: [
    { id: 'louvre', name: 'Louvre Museum', lat: 48.8606, lng: 2.3376, duration: 120, window: { open: h(9), close: h(18) }, priority: 'high' },
    { id: 'eiffel', name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945, duration: 90, window: { open: h(9, 30), close: h(23) }, priority: 'must' },
    { id: 'orsay', name: "Musée d'Orsay", lat: 48.86, lng: 2.3266, duration: 90, window: { open: h(9, 30), close: h(18) }, priority: 'normal' },
    { id: 'sacre', name: 'Sacré-Cœur', lat: 48.8867, lng: 2.3431, duration: 45, window: { open: h(6), close: h(22, 30) }, priority: 'normal' },
    { id: 'notre', name: 'Notre-Dame', lat: 48.853, lng: 2.3499, duration: 30, window: { open: h(7, 45), close: h(19) }, priority: 'normal' },
    { id: 'lunch', name: 'Lunch · Place des Vosges', lat: 48.8556, lng: 2.3655, duration: 60, window: { open: h(12), close: h(14, 30) }, priority: 'high' },
    { id: 'arc', name: 'Arc de Triomphe', lat: 48.8738, lng: 2.295, duration: 40, window: { open: h(10), close: h(23) }, priority: 'low' },
    { id: 'chapelle', name: 'Sainte-Chapelle', lat: 48.8554, lng: 2.345, duration: 45, window: { open: h(9), close: h(19) }, priority: 'low' },
  ],
}
