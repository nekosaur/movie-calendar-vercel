import axios from 'axios'
import { onMounted, ref } from 'vue'
import { toZonedTime } from 'date-fns-tz'

export type Showtime = {
  theater: string
  url: string
  movie: {
    title: string
    url: string
    genres: string[]
    duration: number
    synopsis: string
  }
  time: Date
  tags: string[]
}

export type ShowtimeEvent = {
  start: Date
  end: Date
} & Showtime

export function useShowtimes() {
  const showtimes = ref<ShowtimeEvent[]>([])

  async function load() {
    const response = await axios.get<Showtime[]>('/api/showtimes')

    showtimes.value = response.data
      .map((showtime: Showtime) => ({
        start: toZonedTime(showtime.time, 'UTC'),
        end: toZonedTime(showtime.time, 'UTC'),
        ...showtime
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  onMounted(() => {
    load()
  })

  return { showtimes }
}
