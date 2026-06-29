import { useState } from 'react'
import './App.css'

type SendState = 'idle' | 'sending' | 'sent' | 'error'

const todayISO = new Date().toISOString().slice(0, 10)

function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  })
}

async function sendToTelegram(
  name: string,
  wishes: string,
  date: string,
  choices: Record<string, Option>,
): Promise<void> {
  const res = await fetch('/api/send-telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      wishes: wishes.trim(),
      date: formatDate(date),
      place: choices.place?.label,
      dish: choices.dish?.label,
      time: choices.time?.label,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
}

type Option = {
  id: string
  label: string
  emoji: string
  desc: string
}

const places: Option[] = [
  { id: 'restaurant', label: 'Ресторан', emoji: '🍽️', desc: 'Уютный зал и свечи' },
  { id: 'park', label: 'Парк', emoji: '🌳', desc: 'Прогулка на свежем воздухе' },
  { id: 'cafe', label: 'Кофейня', emoji: '☕', desc: 'Уютно за чашкой кофе' },
  { id: 'cinema', label: 'Кино', emoji: '🎬', desc: 'Тёмный зал и попкорн' },
]

const dishes: Option[] = [
  { id: 'pasta', label: 'Паста', emoji: '🍝', desc: 'Классика по-итальянски' },
  { id: 'sushi', label: 'Суши', emoji: '🍣', desc: 'Свежо и легко' },
  { id: 'steak', label: 'Стейк', emoji: '🥩', desc: 'Сытно и красиво' },
  { id: 'dessert', label: 'Десерт', emoji: '🍰', desc: 'Для сладкого вечера' },
]

// какие блюда уместны в каждом месте (id блюд)
const allDishIds = dishes.map((d) => d.id)
const dishesByPlace: Record<string, string[]> = {
  restaurant: allDishIds, // в ресторане можно всё
  cafe: ['pasta', 'sushi', 'dessert'], // в кофейне стейк не подадут
  park: ['sushi', 'dessert'], // в парке — только то, что удобно есть на ходу
  cinema: ['dessert'], // в тёмном зале — только лёгкий перекус
}

function allowedDishIds(placeId?: string): string[] {
  return (placeId && dishesByPlace[placeId]) || allDishIds
}

// подсказка, почему часть блюд скрыта
const dishHintByPlace: Record<string, string> = {
  cafe: 'В кофейне стейк не подают 🥩',
  park: 'В парке — только то, что удобно есть на ходу 🌳',
  cinema: 'В тёмном зале — лёгкий перекус 🍿',
}

const times: Option[] = [
  { id: '12:00', label: '12:00', emoji: '☀️', desc: 'Обеденное свидание' },
  { id: '15:00', label: '15:00', emoji: '🌤️', desc: 'Дневная встреча' },
  { id: '18:00', label: '18:00', emoji: '🌇', desc: 'Ранний вечер' },
  { id: '20:00', label: '20:00', emoji: '🌙', desc: 'Романтичный ужин' },
]

const steps = [
  { key: 'place', title: 'Где встретимся?', options: places },
  { key: 'dish', title: 'Что закажем?', options: dishes },
  { key: 'time', title: 'Во сколько?', options: times },
] as const

function App() {
  const [started, setStarted] = useState(false)
  const [noOffset, setNoOffset] = useState({ x: 0, y: 0 })
  const [step, setStep] = useState(0)
  const [choices, setChoices] = useState<Record<string, Option>>({})
  const [done, setDone] = useState(false)
  const [name, setName] = useState('')
  const [wishes, setWishes] = useState('')
  const [date, setDate] = useState('')
  const [sendState, setSendState] = useState<SendState>('idle')
  const [sendError, setSendError] = useState('')

  async function submit() {
    setSendState('sending')
    setSendError('')
    try {
      await sendToTelegram(name, wishes, date, choices)
      setSendState('sent')
    } catch (e) {
      setSendState('error')
      setSendError(e instanceof Error ? e.message : 'Не удалось отправить')
    }
  }

  const current = steps[step]
  const isLast = step === steps.length - 1
  const selected = choices[current.key]

  // на шаге блюда показываем только то, что уместно в выбранном месте
  const currentOptions =
    current.key === 'dish'
      ? dishes.filter((d) => allowedDishIds(choices.place?.id).includes(d.id))
      : current.options
  const dishHint =
    current.key === 'dish' ? dishHintByPlace[choices.place?.id ?? ''] : ''

  function pick(option: Option) {
    setChoices((prev) => {
      const nextChoices = { ...prev, [current.key]: option }
      // если поменяли место и выбранное ранее блюдо там недоступно — сбрасываем его
      if (current.key === 'place' && prev.dish) {
        if (!allowedDishIds(option.id).includes(prev.dish.id)) {
          delete nextChoices.dish
        }
      }
      return nextChoices
    })
  }

  function next() {
    if (!selected) return
    if (isLast) {
      setDone(true)
      void submit()
    } else setStep((s) => s + 1)
  }

  function back() {
    if (step > 0) setStep((s) => s - 1)
  }

  function reset() {
    setChoices({})
    setStep(0)
    setDone(false)
    setName('')
    setWishes('')
    setDate('')
    setSendState('idle')
    setSendError('')
  }

  function dodgeNo() {
    // на тач-экранах прыжок поменьше, чтобы кнопка не улетала за край;
    // на десктопе с мышью — обычный, живой
    const isTouch = window.matchMedia('(pointer: coarse)').matches
    const rangeX = isTouch ? 110 : 260
    const rangeY = isTouch ? 80 : 150
    setNoOffset({
      x: (Math.random() - 0.5) * rangeX,
      y: (Math.random() - 0.5) * rangeY,
    })
  }

  if (!started) {
    return (
      <main className="screen">
        <div className="card intro">
          <div className="confetti">🥰</div>
          <h1>Хочешь пойти со мной на свидание?</h1>
          <p className="intro-sub">Давай придумаем идеальный вечер вместе 💕</p>
          <div className="intro-actions">
            <button className="primary" onClick={() => setStarted(true)}>
              Да, хочу! 💕
            </button>
            <button
              className="ghost no-btn"
              style={{ transform: `translate(${noOffset.x}px, ${noOffset.y}px)` }}
              onMouseEnter={dodgeNo}
              onTouchStart={dodgeNo}
              onClick={dodgeNo}
            >
              Нет
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (done) {
    return (
      <main className="screen">
        <div className="card result">
          <div className="confetti">💖</div>
          <h1>Свидание назначено!</h1>
          {name.trim() && <p className="invite-from">от {name.trim()} 💕</p>}
          <ul className="summary">
            <li>
              <span>{choices.place.emoji}</span> {choices.place.label}
            </li>
            <li>
              <span>{choices.dish.emoji}</span> {choices.dish.label}
            </li>
            <li>
              <span>{choices.time.emoji}</span> {formatDate(date)} в {choices.time.label}
            </li>
          </ul>

          {wishes.trim() && <p className="wishes-note">📝 {wishes.trim()}</p>}

          <p className={`tg-status ${sendState}`}>
            {sendState === 'sending' && '✈️ Отправляем в Telegram…'}
            {sendState === 'sent' && '✅ Отправлено в Telegram'}
            {sendState === 'error' && `⚠️ ${sendError}`}
          </p>

          {sendState === 'error' && (
            <button className="ghost" onClick={() => void submit()}>
              Попробовать ещё раз
            </button>
          )}

          <button className="primary" onClick={reset}>
            Назначить ещё одно
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="screen">
      <div className="card">
        <div className="progress">
          {steps.map((s, i) => (
            <div
              key={s.key}
              className={`dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
            />
          ))}
        </div>

        <h1>{current.title}</h1>

        {dishHint && <p className="dish-hint">{dishHint}</p>}

        {step === 0 && (
          <input
            className="name-input"
            type="text"
            placeholder="Как тебя зовут?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
        )}

        <div className="options">
          {currentOptions.map((option) => (
            <button
              key={option.id}
              className={`option ${selected?.id === option.id ? 'selected' : ''}`}
              onClick={() => pick(option)}
            >
              <span className="emoji">{option.emoji}</span>
              <span className="label">{option.label}</span>
              <span className="desc">{option.desc}</span>
            </button>
          ))}
        </div>

        {isLast && (
          <label className="date-field">
            <span className="field-label">📅 Выберите дату свидания</span>
            <input
              className="date-input"
              type="date"
              min={todayISO}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        )}

        {isLast && (
          <textarea
            className="wishes-input"
            placeholder="Пожелания к свиданию (необязательно): дресс-код, сюрприз, плейлист…"
            value={wishes}
            onChange={(e) => setWishes(e.target.value)}
            maxLength={300}
            rows={3}
          />
        )}

        <div className="actions">
          {step > 0 && (
            <button className="ghost" onClick={back}>
              Назад
            </button>
          )}
          <button
            className="primary"
            onClick={next}
            disabled={!selected || (step === 0 && !name.trim()) || (isLast && !date)}
          >
            {isLast ? 'Готово' : 'Дальше'}
          </button>
        </div>
      </div>
    </main>
  )
}

export default App
