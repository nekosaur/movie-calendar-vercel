import type { VercelRequest, VercelResponse } from '@vercel/node'

type SearchResponse = {
  page: number
  results: {
    id: number
    title: string
  }[]
  total_pages: number
  total_results: number
}

type ExternalIdsResponse = {
  id: number
  imdb_id: string
}

const headers = {
  Authorization: `Bearer ${process.env.TMDB_API_TOKEN}`,
  Accept: 'application/json'
}

export default async function (
  request: VercelRequest,
  response: VercelResponse
) {
  const title = String(request.query.title)
    .replace(/^Cine:|-\sKlassiker$/, '')
    .trim()

  const searchResponse = await fetch(
    `https://api.themoviedb.org/3/search/movie?query=${title}&include_adult=false&language=sv-SE&page=1`,
    {
      method: 'GET',
      headers
    }
  )

  const searchJson = (await searchResponse.json()) as SearchResponse

  // TODO: some validation that first result is the correct one?
  if (searchJson.results.length) {
    const externals = await fetch(
      `https://api.themoviedb.org/3/movie/${searchJson.results[0].id}/external_ids`,
      { method: 'GET', headers }
    )

    const externalsJson = (await externals.json()) as ExternalIdsResponse

    return response.json({
      tmdb_url: `https://www.themoviedb.org/movie/${externalsJson.id}`,
      imdb_url: externalsJson.imdb_id
        ? `https://www.imdb.com/title/${externalsJson.imdb_id}`
        : null
    })
  }

  return response.json({
    tmdb_url: null,
    imdb_url: null
  })
}
