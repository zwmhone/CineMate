import {
  listUserFavourites,
  listUserWatchStates,
} from "@/lib/userInteractions";
import { listUserRatings } from "@/lib/ratings";
import { listRecommendationFeedback } from "@/lib/recommendationFeedback";
import {
  discoverMovies,
  discoverTvShows,
  getMovieDetails,
  getMovieGenres,
  getMovieKeywords,
  getMovieRecommendations,
  getSimilarMovies,
  getSimilarTvShows,
  getTvDetails,
  getTvGenres,
  getTvKeywords,
  getTvRecommendations,
  searchMultiTitles,
  searchTmdbKeywords,
} from "@/lib/tmdb";
import { applyRuntime, formatTmdbMovie } from "@/utils/formatMovie";

const DEFAULT_LIMIT = 24;
const MIN_ACTIVITY_ITEMS = 5;
const MAX_SEEDS = 12;
const MAX_HYDRATE = 60;
const MIN_MOVIE_RUNTIME = 45;

const GENERIC_KEYWORDS = new Set([
  "based on novel or book",
  "woman director",
  "sequel",
  "duringcreditsstinger",
  "aftercreditsstinger",
  "friendship",
  "love",
  "family",
  "murder",
  "police",
  "new york city",
  "high school",
  "based on true story",
  "teenager",
  "investigation",
  "coming of age",
]);

const BROAD_GENRES = new Set([
  "drama",
  "action",
  "adventure",
  "comedy",
  "family",
]);
const MEANINGFUL_GENRES = new Set([
  "crime",
  "mystery",
  "thriller",
  "science fiction",
  "sci-fi & fantasy",
  "fantasy",
  "animation",
  "horror",
  "romance",
  "war & politics",
  "documentary",
]);
const SPECIFIC_GENRES = new Set([
  "animation",
  "sci-fi & fantasy",
  "science fiction",
  "fantasy",
  "horror",
  "thriller",
  "romance",
  "war & politics",
  "documentary",
]);

const WEAK_EXPLANATION_GENRES = new Set([
  "animation",
  "family",
  "adventure",
  "action",
  "comedy",
  "drama",
  "tv movie",
]);
const BROAD_EXPLANATION_CLUSTERS = new Set([
  "animationAnime",
  "fantasyAdventure",
  "comedy",
  "drama",
  "familyAnimation",
]);
const BROAD_EXPLANATION_TONES = new Set(["animeFantasy", "warmStylised"]);
const CORE_EXPLANATION_GENRES = new Set([
  "crime",
  "mystery",
  "thriller",
  "science fiction",
  "sci-fi & fantasy",
  "horror",
  "romance",
  "documentary",
  "war & politics",
]);

const TONE_PATTERNS = {
  cerebral:
    /inception|arrival|parasite|truman|everything everywhere|ex machina|annihilation|severance|dark|black mirror|mind|dream|memory|time|identity|parallel|surreal|philosophical|psychological|existential|high concept|alternate reality|simulation|consciousness|memory/,
  warmStylised:
    /spirited away|grand budapest|before sunrise|amelie|ghibli|whimsical|bittersweet|quirky|tender|romantic|heartfelt|coming of age|slice of life|poetic|stylized|stylised/,
  intenseAction:
    /mad max|fury road|john wick|mission impossible|warrior|revenge|chase|survival|post-apocalyptic|dystopian|fast-paced|martial arts|assassin|heist/,
  mysteryPuzzle:
    /knives out|nancy drew|detective|whodunit|mystery|investigation|clue|murder mystery|case|puzzle|twist|conspiracy/,
  darkHorror:
    /horror|slasher|killer|haunted|ghost|curse|death|mummy|stepfather|flatliners|scream|vampire|zombie|supernatural horror|psychological horror|possession/,
  animeFantasy:
    /anime|manga|naruto|bleach|akira|evangelion|avatar|aang|airbender|spirit|magic|dragon|demon|jujutsu|one piece|shippuden|studio ghibli/,
  superhero:
    /invincible|spider|superhero|marvel|dc|comic|masked|hero|vigilante|super power|powers/,
  socialThriller:
    /parasite|get out|class|wealth|poverty|social|satire|capitalism|inequality|revenge|family secret/,
};

const CLUSTER_LABELS = {
  animationAnime: "animation/anime",
  fantasyAdventure: "fantasy adventure",
  horrorThriller: "horror/thriller",
  sciFiSpace: "science fiction",
  superheroComic: "superhero/comic",
  mysteryCrime: "mystery/crime",
  comedy: "comedy",
  drama: "drama",
  cerebralSciFi: "cerebral sci-fi",
  socialThriller: "social thriller",
  magicSchoolFantasy: "magic-school fantasy",
  eastAsianMyth: "East Asian mythology",
  supernaturalOccult: "supernatural occult",
  darkPsychologicalAnime: "dark psychological anime",
  familyAnimation: "family animation",
};

const CURATED_BY_CLUSTER = {
  animationAnime: [
    "The Legend of Korra",
    "The Dragon Prince",
    "Fullmetal Alchemist Brotherhood",
    "Demon Slayer",
    "Hunter x Hunter",
    "Mob Psycho 100",
    "One Punch Man",
  ],
  fantasyAdventure: [
    "The Legend of Korra",
    "The Dragon Prince",
    "Merlin",
    "His Dark Materials",
    "Shadow and Bone",
    "Lockwood & Co.",
  ],
  horrorThriller: [
    "Happy Death Day 2U",
    "Freaky",
    "Fear Street",
    "Final Destination",
    "Scream",
    "Flatliners",
    "The Haunting of Hill House",
  ],
  sciFiSpace: [
    "Star Trek Strange New Worlds",
    "Star Wars Rebels",
    "The Expanse",
    "Doctor Who",
  ],
  superheroComic: [
    "Invincible",
    "Young Justice",
    "The Spectacular Spider-Man",
    "Doom Patrol",
  ],
  mysteryCrime: [
    "Nancy Drew",
    "Veronica Mars",
    "Only Murders in the Building",
    "Lockwood & Co.",
  ],
  comedy: [
    "Scary Movie 2",
    "Shaun of the Dead",
    "What We Do in the Shadows",
    "Ghosts",
  ],
  drama: ["Dark", "Black Mirror", "Severance"],
  cerebralSciFi: [
    "Ex Machina",
    "Annihilation",
    "Dark",
    "Black Mirror",
    "Severance",
    "Moon",
  ],
  socialThriller: [
    "Get Out",
    "Burning",
    "The Handmaiden",
    "Shoplifters",
    "Memories of Murder",
  ],
};

function normalise(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function splitGenres(value) {
  if (Array.isArray(value))
    return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(/\s*[•,/|]\s*/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function addWeight(map, label, points = 1) {
  const key = normalise(label);
  if (!key || !Number.isFinite(points) || points === 0) return;
  const current = map.get(key) || { label, score: 0 };
  current.score += points;
  current.label = current.label || label;
  map.set(key, current);
}

function addNumberWeight(map, label, points = 1) {
  const key = normalise(label);
  if (!key || !Number.isFinite(points) || points === 0) return;
  map.set(key, (map.get(key) || 0) + points);
}

function cleanLabel(label = "") {
  return String(label || "")
    .replace(/\s+/g, " ")
    .trim();
}

function genreSignalMultiplier(genre = "") {
  const key = normalise(genre);
  if (BROAD_GENRES.has(key)) return 0.46;
  if (MEANINGFUL_GENRES.has(key)) return 1.18;
  if (SPECIFIC_GENRES.has(key)) return 1.28;
  return 1;
}

function weightedGenrePoints(genre, points) {
  return points * genreSignalMultiplier(genre);
}

function storedMovieId(movie = {}) {
  const raw =
    movie?.dbMovieId ??
    movie?.storedMovieId ??
    movie?.movie_id ??
    movie?.tmdbId ??
    movie?.tmdb_id ??
    movie?.id;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (movie?.mediaType === "tv" || movie?.media_type === "tv")
    return -Math.abs(value);
  return value;
}

function publicTmdbId(movie = {}) {
  const raw =
    movie?.tmdbId ??
    movie?.tmdb_id ??
    movie?.id ??
    movie?.movie_id ??
    movie?.dbMovieId;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.abs(value) : raw;
}

function mediaTypeFromMovie(movie = {}) {
  if (movie?.mediaType === "tv" || movie?.media_type === "tv") return "tv";
  const storedId = Number(movie?.dbMovieId ?? movie?.movie_id);
  if (Number.isFinite(storedId) && storedId < 0) return "tv";
  const genres = String(movie?.genre || movie?.genres || "").toLowerCase();
  if (
    /sci-fi & fantasy|action & adventure|kids|war & politics|talk|soap|reality/.test(
      genres,
    )
  )
    return "tv";
  return "movie";
}

function normaliseInteractionMovie(row = {}, fallback = {}) {
  const movie = row.movie || row.movies || row;
  const dbMovieId = storedMovieId(movie) ?? storedMovieId(row);
  const mediaType = mediaTypeFromMovie({ ...movie, dbMovieId });
  const tmdbId = publicTmdbId({ ...movie, dbMovieId });
  const genreText = movie.genre || movie.genres || fallback.genre || "";
  const tags =
    Array.isArray(movie.tags) && movie.tags.length
      ? movie.tags
      : splitGenres(genreText);

  return {
    id: tmdbId,
    tmdbId,
    dbMovieId: Number.isFinite(Number(dbMovieId))
      ? Number(dbMovieId)
      : mediaType === "tv"
        ? -Math.abs(Number(tmdbId))
        : Number(tmdbId),
    mediaType,
    title:
      movie.title ||
      fallback.title ||
      `${mediaType === "tv" ? "TV Show" : "Movie"} ${tmdbId}`,
    genre: tags.length
      ? tags.join(" • ")
      : mediaType === "tv"
        ? "TV Show"
        : "Movie",
    tags,
    rating: movie.rating || movie.tmdb_rating || null,
    runtime: movie.runtime
      ? Number.isFinite(Number(movie.runtime))
        ? `${movie.runtime}m`
        : movie.runtime
      : "Runtime TBA",
    poster: movie.poster || movie.poster_url || movie.posterUrl || "",
    posterPath: movie.posterPath || movie.poster_path || "",
    overview: movie.overview || "",
    releaseDate: movie.releaseDate || movie.release_date || "",
    createdAt:
      row.created_at ||
      row.createdAt ||
      movie.created_at ||
      movie.createdAt ||
      "",
    originalLanguage:
      movie.originalLanguage || movie.original_language || movie.language || "",
  };
}

function interactionKey(movie = {}) {
  const mediaType = mediaTypeFromMovie(movie);
  const tmdbId = publicTmdbId(movie);
  return `${mediaType}:${tmdbId}`;
}

function buildGenreIdMap(movieGenres = [], tvGenres = []) {
  return {
    movie: new Map(
      movieGenres.map((genre) => [normalise(genre.name), genre.id]),
    ),
    tv: new Map(tvGenres.map((genre) => [normalise(genre.name), genre.id])),
    movieNames: movieGenres.reduce(
      (map, genre) => ({ ...map, [genre.id]: genre.name }),
      {},
    ),
    tvNames: tvGenres.reduce(
      (map, genre) => ({ ...map, [genre.id]: genre.name }),
      {},
    ),
  };
}

function runtimeMinutes(runtime) {
  const value = Number(String(runtime || "").match(/\d+/)?.[0] || 0);
  return Number.isFinite(value) ? value : 0;
}

function textBlob(item = {}) {
  return `${item.title || ""} ${item.overview || ""} ${(item.tags || []).join(" ")} ${(item.keywordNames ? [...item.keywordNames] : []).join(" ")} ${(item.searchTerms ? [...item.searchTerms] : []).join(" ")}`.toLowerCase();
}

function titleTasteSignals(item = {}) {
  const text = textBlob(item);
  const tags = new Set((item.tags || []).map(normalise));
  const language = normalise(item.originalLanguage);

  return {
    animationAnime:
      /anime|manga|naruto|bleach|noragami|evangelion|akira|demon slayer|jujutsu|hunter x hunter|one piece|dragon ball|shippuden/.test(
        text,
      ) ||
      (tags.has("animation") && language === "ja") ||
      (tags.has("animation") &&
        /avatar|aang|airbender|korra|dragon prince/.test(text)),
    fantasyAdventure:
      /avatar|aang|airbender|korra|magic|spirit|supernatural|fantasy|dragon|heaven|mandalorian|grogu|star wars|journey|quest|myth/.test(
        text,
      ) ||
      tags.has("sci-fi & fantasy") ||
      tags.has("fantasy"),
    horrorThriller:
      /horror|thriller|scream|killer|slasher|death day|flatliners|stepfather|mummy|scary movie|haunted|ghost|kill|vampire|zombie/.test(
        text,
      ) ||
      tags.has("horror") ||
      tags.has("thriller"),
    sciFiSpace:
      /star trek|star wars|space|alien|future|science fiction|sci-fi|mandalorian|akira|evangelion|time travel|multiverse|parallel|technology|robot|android|artificial intelligence|simulation/.test(
        text,
      ) ||
      tags.has("science fiction") ||
      tags.has("sci-fi & fantasy"),
    superheroComic:
      /superhero|comic|invincible|spider|marvel|dc|masked vigilante|hero/.test(
        text,
      ),
    mysteryCrime:
      /mystery|detective|nancy drew|crime|investigation|whodunit|murder|clue|case|conspiracy/.test(
        text,
      ) ||
      tags.has("mystery") ||
      tags.has("crime"),
    comedy:
      /comedy|scary movie|funny|parody|satire/.test(text) || tags.has("comedy"),
    drama: tags.has("drama"),
    cerebralSciFi:
      /inception|arrival|truman|everything everywhere|ex machina|annihilation|dark|black mirror|severance|mind|dream|time|identity|simulation|multiverse/.test(
        text,
      ) &&
      (tags.has("science fiction") ||
        tags.has("sci-fi & fantasy") ||
        tags.has("thriller") ||
        tags.has("drama")),
    socialThriller:
      /parasite|get out|class|wealth|poverty|social|satire|inequality|family secret/.test(
        text,
      ) &&
      (tags.has("thriller") || tags.has("drama") || tags.has("comedy")),
    magicSchoolFantasy:
      /harry potter|hogwarts|wizard|witchcraft|spell|sorcerer|fantastic beasts|magic school/.test(
        text,
      ),
    eastAsianMyth:
      /nezha|ne zha|dragon king|monkey king|journey to the west|chinese myth|chinese mythology|deity|lotus/.test(
        text,
      ),
    supernaturalOccult:
      /xxxholic|x holic|occult|curse|spirit world|supernatural|yokai|exorcist|medium|ghost story/.test(
        text,
      ),
    darkPsychologicalAnime:
      /perfect blue|satoshi kon|paprika|paranoia agent|psychological|stalker|delusion|identity crisis|nightmare/.test(
        text,
      ),
    familyAnimation: tags.has("animation") && tags.has("family"),
  };
}

function clusterVector(item = {}) {
  const signals = titleTasteSignals(item);
  return Object.entries(signals)
    .filter(([, active]) => active)
    .map(([name]) => name);
}

function toneVector(item = {}) {
  const text = textBlob(item);
  return Object.entries(TONE_PATTERNS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([tone]) => tone);
}

function releaseYear(item = {}) {
  const raw =
    item.releaseDate ||
    item.date ||
    item.first_air_date ||
    item.release_date ||
    "";
  const year = Number(String(raw).match(/\d{4}/)?.[0] || 0);
  return Number.isFinite(year) && year > 0 ? year : null;
}

function releaseDecade(item = {}) {
  const year = releaseYear(item);
  return year ? Math.floor(year / 10) * 10 : null;
}

function recencyMultiplier(createdAt) {
  const time = Date.parse(createdAt || "");
  if (!Number.isFinite(time)) return 1;
  const ageDays = Math.max(0, (Date.now() - time) / 86400000);
  if (ageDays <= 14) return 1.22;
  if (ageDays <= 45) return 1.12;
  if (ageDays <= 120) return 1.04;
  if (ageDays >= 365) return 0.72;
  return 1;
}

function addClusterWeights(map, movie, points) {
  clusterVector(movie).forEach((cluster) =>
    addNumberWeight(map, cluster, points),
  );
}

function addToneWeights(map, movie, points) {
  toneVector(movie).forEach((tone) => addNumberWeight(map, tone, points));
}

function addDecadeWeights(map, movie, points) {
  const decade = releaseDecade(movie);
  if (decade) addNumberWeight(map, String(decade), points);
}

function normaliseCandidate(raw, mediaType, genreNames, index = 0) {
  return formatTmdbMovie(
    { ...raw, media_type: mediaType },
    genreNames,
    index,
    mediaType,
  );
}

function hasEnoughQuality(candidate = {}, allowNoPoster = true) {
  if (!candidate?.tmdbId) return false;
  if (!allowNoPoster && !candidate.hasPoster && !candidate.posterPath)
    return false;
  const rating = Number(candidate.rating || candidate.vote_average || 0);
  const voteCount = Number(candidate.voteCount || candidate.vote_count || 0);
  if (rating <= 0 && voteCount <= 0) return false;
  if (candidate.mediaType === "movie") {
    const minutes = runtimeMinutes(candidate.runtime);
    if (minutes && minutes < MIN_MOVIE_RUNTIME) return false;
  }
  return true;
}

function seedWeight(seed = {}) {
  if (seed.source === "ratings")
    return Math.max(12, Number(seed.signalWeight || 12));
  if (seed.source === "favourites") return 14;
  if (seed.source === "watching") return 12;
  if (seed.source === "wishlist") return 9;
  if (seed.source === "watched") return 8;
  return 6;
}

function createSeed(movie, source, signalWeight = null) {
  return {
    ...movie,
    source,
    signalWeight: signalWeight || seedWeight({ source }),
    sourceTitle: movie.title,
    sourceGenres: movie.tags || [],
  };
}

function topClusterNames(profile = {}, count = 4) {
  return Object.entries(profile.clusterWeights || {})
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([cluster]) => cluster);
}

function topGenreIds(profile = {}, genreIdMap, mediaType = "movie") {
  return (profile.rankedGenres || [])
    .map((genre) => genreIdMap[mediaType].get(normalise(genre.label)))
    .filter(Boolean)
    .slice(0, 5);
}

function genreIdForLabel(label = "", genreIdMap, mediaType = "movie") {
  const key = normalise(label);
  if (!key || key === "all") return null;
  return genreIdMap?.[mediaType]?.get(key) || null;
}

function candidateHasGenre(candidate = {}, genre = "") {
  const key = normalise(genre);
  if (!key || key === "all") return true;
  return (candidate.tags || []).some((tag) => normalise(tag) === key);
}

function genreOverlapLabels(candidate = {}, sourceGenres = []) {
  const candidateGenres = new Set((candidate.tags || []).map(normalise));
  return (sourceGenres || [])
    .filter((genre) => candidateGenres.has(normalise(genre)))
    .map(cleanLabel)
    .filter(Boolean)
    .slice(0, 3);
}

function profileGenreOverlap(candidate = {}, rankedGenres = []) {
  const profileGenres = new Set(
    (rankedGenres || []).map((genre) => normalise(genre.label)),
  );
  return (candidate.tags || [])
    .filter((genre) => profileGenres.has(normalise(genre)))
    .map(cleanLabel)
    .slice(0, 3);
}

function genreOverlapScore(candidate = {}, rankedGenres = []) {
  const genreScores = new Map(
    rankedGenres.map((genre) => [normalise(genre.label), genre.score]),
  );
  return (candidate.tags || []).reduce(
    (total, genre) => total + (genreScores.get(normalise(genre)) || 0),
    0,
  );
}

function negativeGenreScore(candidate = {}, negativeGenres = []) {
  const genreScores = new Map(
    negativeGenres.map((genre) => [
      normalise(genre.label),
      Math.abs(genre.score),
    ]),
  );
  return (candidate.tags || []).reduce(
    (total, genre) => total + (genreScores.get(normalise(genre)) || 0),
    0,
  );
}

function clusterOverlapScore(candidate = {}, clusterWeights = {}) {
  return clusterVector(candidate).reduce(
    (total, cluster) => total + Math.max(0, clusterWeights[cluster] || 0),
    0,
  );
}

function negativeClusterScore(candidate = {}, negativeClusterWeights = {}) {
  return clusterVector(candidate).reduce(
    (total, cluster) =>
      total + Math.abs(Math.min(0, negativeClusterWeights[cluster] || 0)),
    0,
  );
}

function toneOverlapScore(candidate = {}, toneWeights = {}) {
  return toneVector(candidate).reduce(
    (total, tone) => total + Math.max(0, toneWeights[tone] || 0),
    0,
  );
}

function negativeToneScore(candidate = {}, negativeToneWeights = {}) {
  return toneVector(candidate).reduce(
    (total, tone) =>
      total + Math.abs(Math.min(0, negativeToneWeights[tone] || 0)),
    0,
  );
}

function decadeScore(candidate = {}, decadeWeights = {}) {
  const decade = releaseDecade(candidate);
  if (!decade) return 0;
  const direct = decadeWeights[String(decade)] || 0;
  const close =
    (decadeWeights[String(decade - 10)] || 0) * 0.35 +
    (decadeWeights[String(decade + 10)] || 0) * 0.35;
  return Math.max(0, direct + close);
}

function profileGenreOverlapCount(candidate = {}, rankedGenres = []) {
  const profileGenres = new Set(
    (rankedGenres || []).map((genre) => normalise(genre.label)),
  );
  return (candidate.tags || []).filter((genre) =>
    profileGenres.has(normalise(genre)),
  ).length;
}

function specificProfileOverlapCount(candidate = {}, rankedGenres = []) {
  const profileGenres = new Set(
    (rankedGenres || []).map((genre) => normalise(genre.label)),
  );
  return (candidate.tags || []).filter((genre) => {
    const key = normalise(genre);
    return profileGenres.has(key) && SPECIFIC_GENRES.has(key);
  }).length;
}

function maxSourceGenreOverlap(candidate = {}) {
  const candidateGenres = new Set((candidate.tags || []).map(normalise));
  return Math.max(
    0,
    ...Object.values(candidate.sourceGenreMap || {}).map(
      (genres) =>
        (genres || []).filter((genre) => candidateGenres.has(normalise(genre)))
          .length,
    ),
  );
}

function hasSpecificSharedSourceGenre(candidate = {}) {
  const candidateGenres = new Set((candidate.tags || []).map(normalise));
  return Object.values(candidate.sourceGenreMap || {}).some((genres) =>
    (genres || []).some(
      (genre) =>
        candidateGenres.has(normalise(genre)) &&
        SPECIFIC_GENRES.has(normalise(genre)),
    ),
  );
}

function candidatePrimaryCluster(candidate = {}, profile = {}) {
  const clusters = clusterVector(candidate);
  if (!clusters.length) return "other";
  return (
    clusters
      .map((cluster) => ({
        cluster,
        score: profile.clusterWeights?.[cluster] || 0,
      }))
      .sort((a, b) => b.score - a.score)[0]?.cluster || clusters[0]
  );
}

function mergeCandidate(map, candidate, patch = {}) {
  const key = interactionKey(candidate);
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      ...candidate,
      sourceBonus: patch.sourceBonus || 0,
      sourceNames: new Set(patch.sourceNames || []),
      keywordNames: new Set(patch.keywordNames || []),
      searchTerms: new Set(patch.searchTerms || []),
      sourceTitles: patch.sourceTitle ? [patch.sourceTitle] : [],
      sourceGenreMap: patch.sourceTitle
        ? { [patch.sourceTitle]: patch.sourceGenres || [] }
        : {},
    });
    return;
  }

  existing.sourceBonus = Math.max(
    existing.sourceBonus || 0,
    patch.sourceBonus || 0,
  );
  existing.popularity = Math.max(
    Number(existing.popularity || 0),
    Number(candidate.popularity || 0),
  );
  existing.voteCount = Math.max(
    Number(existing.voteCount || 0),
    Number(candidate.voteCount || 0),
  );
  existing.hasPoster = existing.hasPoster || candidate.hasPoster;
  existing.posterPath = existing.posterPath || candidate.posterPath;
  existing.poster = existing.hasPoster
    ? existing.poster || candidate.poster
    : candidate.poster || existing.poster;
  (patch.sourceNames || []).forEach((source) =>
    existing.sourceNames.add(source),
  );
  (patch.keywordNames || []).forEach((keyword) =>
    existing.keywordNames.add(keyword),
  );
  (patch.searchTerms || []).forEach((term) => existing.searchTerms.add(term));
  if (patch.sourceTitle && !existing.sourceTitles.includes(patch.sourceTitle)) {
    existing.sourceTitles.push(patch.sourceTitle);
    existing.sourceGenreMap[patch.sourceTitle] = patch.sourceGenres || [];
  }
}

function strongSharedGenres(genres = []) {
  return genres.filter((genre) => {
    const key = normalise(genre);
    return (
      key &&
      CORE_EXPLANATION_GENRES.has(key) &&
      !WEAK_EXPLANATION_GENRES.has(key)
    );
  });
}

function supportingSharedGenres(genres = []) {
  return genres.filter((genre) => {
    const key = normalise(genre);
    return key && !WEAK_EXPLANATION_GENRES.has(key) && !BROAD_GENRES.has(key);
  });
}

function hasStrongSharedCluster(seed = {}, candidate = {}) {
  const candidateClusters = new Set(clusterVector(candidate));
  return clusterVector(seed).some(
    (cluster) =>
      candidateClusters.has(cluster) &&
      !BROAD_EXPLANATION_CLUSTERS.has(cluster),
  );
}

function hasStrongSharedTone(seed = {}, candidate = {}) {
  const candidateTones = new Set(toneVector(candidate));
  return toneVector(seed).some(
    (tone) => candidateTones.has(tone) && !BROAD_EXPLANATION_TONES.has(tone),
  );
}

function hasSameAnimeStyle(seed = {}, candidate = {}) {
  const seedTags = new Set((seed.tags || []).map(normalise));
  const candidateTags = new Set((candidate.tags || []).map(normalise));
  const seedLanguage = normalise(seed.originalLanguage);
  const candidateLanguage = normalise(candidate.originalLanguage);
  const seedText = textBlob(seed);
  const candidateText = textBlob(candidate);
  const seedAnime =
    seedTags.has("animation") &&
    (seedLanguage === "ja" ||
      /anime|manga|avatar|aang|airbender|korra|dragon prince|ghibli/.test(
        seedText,
      ));
  const candidateAnime =
    candidateTags.has("animation") &&
    (candidateLanguage === "ja" ||
      /anime|manga|avatar|aang|airbender|korra|dragon prince|ghibli/.test(
        candidateText,
      ));
  return seedAnime && candidateAnime;
}

function isGoodExplanationSource(seed = {}, candidate = {}, sharedGenres = []) {
  const strongGenres = strongSharedGenres(sharedGenres);
  const supportingGenres = supportingSharedGenres(sharedGenres);
  const strongTone = hasStrongSharedTone(seed, candidate);
  const strongCluster = hasStrongSharedCluster(seed, candidate);

  // One broad genre such as Animation, Family, Adventure or Fantasy is not enough.
  // A title can explain another title only when there is either a core shared genre,
  // or a specific tone/cluster connection as well as some genre overlap.
  if (strongGenres.length >= 2) return true;
  if (
    strongGenres.length >= 1 &&
    (strongTone || strongCluster || supportingGenres.length >= 2)
  )
    return true;
  if ((strongTone || strongCluster) && sharedGenres.length >= 1) return true;
  if (hasSameAnimeStyle(seed, candidate) && supportingGenres.length >= 2)
    return true;
  return false;
}

function sourceFitDetails(candidate = {}, profile = {}) {
  const titles = candidate.sourceTitles || [];
  const candidateGenres = new Set((candidate.tags || []).map(normalise));
  const candidateClusters = new Set(clusterVector(candidate));
  const candidateTones = new Set(toneVector(candidate));
  const seeds = profile.seedMovies || [];

  const options = titles
    .map((title) => {
      const seed = seeds.find((item) => item.title === title) || {};
      const sourceGenres = candidate.sourceGenreMap?.[title] || seed.tags || [];
      const sharedGenres = sourceGenres
        .filter((genre) => candidateGenres.has(normalise(genre)))
        .map(cleanLabel)
        .filter(Boolean);
      const meaningfulShared = strongSharedGenres(sharedGenres);
      const supportingShared = supportingSharedGenres(sharedGenres);
      const seedClusters = clusterVector(seed);
      const seedTones = toneVector(seed);
      const sharedClusters = seedClusters.filter((cluster) =>
        candidateClusters.has(cluster),
      );
      const sharedTones = seedTones.filter((tone) => candidateTones.has(tone));
      const strongClusterCount = sharedClusters.filter(
        (cluster) => !BROAD_EXPLANATION_CLUSTERS.has(cluster),
      ).length;
      const goodExplanationFit = isGoodExplanationSource(
        seed,
        candidate,
        sharedGenres,
      );
      const overlapScore =
        meaningfulShared.length * 7 +
        supportingShared.length * 1.4 +
        sharedGenres.length * 0.3 +
        strongClusterCount * 4.5 +
        sharedTones.length * 5 +
        (hasSameAnimeStyle(seed, candidate) ? 2.5 : 0) +
        seedWeight(seed) * 0.04 +
        (goodExplanationFit ? 9 : -8);

      return {
        title,
        seed,
        sourceGenres,
        sharedGenres,
        meaningfulShared,
        supportingShared,
        sharedClusters,
        sharedTones,
        strongClusterCount,
        goodExplanationFit,
        overlapScore,
      };
    })
    .sort(
      (a, b) =>
        b.overlapScore - a.overlapScore ||
        seedWeight(b.seed || {}) - seedWeight(a.seed || {}),
    );

  const best =
    options.find((option) => option.goodExplanationFit) || options[0] || null;
  const goodFit = Boolean(best?.goodExplanationFit);

  return { best, goodFit };
}

function pickSourceTitle(candidate = {}, profile = {}) {
  const { best, goodFit } = sourceFitDetails(candidate, profile);
  if (best && goodFit) return best.title;

  const candidateGenres = new Set((candidate.tags || []).map(normalise));
  const fallbackSeed = [...(profile.seedMovies || [])]
    .map((seed) => {
      const sharedGenres = (seed.tags || [])
        .filter((genre) => candidateGenres.has(normalise(genre)))
        .map(cleanLabel)
        .filter(Boolean);
      if (!isGoodExplanationSource(seed, candidate, sharedGenres)) return null;
      const strongGenres = strongSharedGenres(sharedGenres).length;
      const clusterShared = clusterVector(seed).filter(
        (cluster) =>
          clusterVector(candidate).includes(cluster) &&
          !BROAD_EXPLANATION_CLUSTERS.has(cluster),
      ).length;
      const toneShared = toneVector(seed).filter((tone) =>
        toneVector(candidate).includes(tone),
      ).length;
      return {
        seed,
        score:
          strongGenres * 7 +
          clusterShared * 4 +
          toneShared * 5 +
          seedWeight(seed) * 0.04,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)[0]?.seed;

  return fallbackSeed?.title || "";
}

function sharedGenreText(labels = []) {
  const clean = labels.map(cleanLabel).filter(Boolean).slice(0, 3);
  if (!clean.length) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean[0]}, ${clean[1]} and ${clean[2]}`;
}

function candidateReason(candidate = {}, profile = {}) {
  const candidateGenres = (candidate.tags || [])
    .map(cleanLabel)
    .filter(Boolean);

  const profileGenres = new Set(
    (profile.rankedGenres || []).map((genre) => normalise(genre.label)),
  );

  const matchingMeaningfulGenres = candidateGenres.filter((genre) => {
    const key = normalise(genre);
    return profileGenres.has(key) && !BROAD_GENRES.has(key);
  });

  const matchingSupportingGenres = candidateGenres.filter((genre) => {
    const key = normalise(genre);
    return (
      profileGenres.has(key) &&
      !matchingMeaningfulGenres.some((item) => normalise(item) === key)
    );
  });

  const genreTextFallback = sharedGenreText(
    matchingMeaningfulGenres.length
      ? matchingMeaningfulGenres
      : matchingSupportingGenres,
  );

  if (genreTextFallback) {
    return `Based on your recent activity, this title matches your ${genreTextFallback} preferences.`;
  }

  const matchingClusters = clusterVector(candidate).filter(
    (cluster) =>
      (profile.clusterWeights?.[cluster] || 0) > 0 &&
      !BROAD_EXPLANATION_CLUSTERS.has(cluster),
  );

  if (matchingClusters.length) {
    return 'Based on your recent activity, this title matches similar themes in your CineMate taste profile.';
  }

  return 'Based on your recent activity, this title matches your current CineMate taste profile.';
}

function candidatePersonalMessage(candidate = {}, profile = {}) {
  return candidateReason(candidate, profile);
}

function meaningfulOverlapCount(candidate = {}, profile = {}) {
  const profileGenres = new Set(
    (profile.rankedGenres || []).map((genre) => normalise(genre.label)),
  );
  const meaningfulGenres = (candidate.tags || []).filter((genre) => {
    const key = normalise(genre);
    return profileGenres.has(key) && !BROAD_GENRES.has(key);
  }).length;
  const clusterCount = clusterVector(candidate).filter(
    (cluster) => (profile.clusterWeights?.[cluster] || 0) > 0,
  ).length;
  const toneCount = toneVector(candidate).filter(
    (tone) => (profile.toneWeights?.[tone] || 0) > 0,
  ).length;
  const sourceOverlap = maxSourceGenreOverlap(candidate);
  const strongSourceFit = sourceFitDetails(candidate, profile).goodFit ? 1 : 0;
  return (
    meaningfulGenres +
    Math.min(2, clusterCount) +
    Math.min(2, toneCount) +
    strongSourceFit +
    (sourceOverlap >= 3 ? 1 : 0)
  );
}

function sourceRelationshipScore(candidate = {}, profile = {}) {
  const titles = candidate.sourceTitles || [];
  if (!titles.length) return 0;
  const seeds = profile.seedMovies || [];
  return titles.reduce((total, title) => {
    const seed = seeds.find((item) => item.title === title);
    if (!seed) return total;
    const overlap = candidate.sourceGenreMap?.[title] || [];
    const candidateGenres = new Set((candidate.tags || []).map(normalise));
    const sharedGenres = overlap
      .filter((genre) => candidateGenres.has(normalise(genre)))
      .map(cleanLabel)
      .filter(Boolean);
    if (!isGoodExplanationSource(seed, candidate, sharedGenres)) return total;
    const sharedSpecific = strongSharedGenres(sharedGenres).length;
    const sharedSupporting = supportingSharedGenres(sharedGenres).length;
    const clusterBonus = hasStrongSharedCluster(seed, candidate) ? 3.5 : 0;
    const toneBonus = hasStrongSharedTone(seed, candidate) ? 4.5 : 0;
    const animeBonus = hasSameAnimeStyle(seed, candidate) ? 2 : 0;
    return (
      total +
      Math.min(
        20,
        seedWeight(seed || {}) * 0.28 +
          sharedSpecific * 5.5 +
          sharedSupporting * 1.4 +
          clusterBonus +
          toneBonus +
          animeBonus,
      )
    );
  }, 0);
}

function qualityPoints(candidate = {}) {
  const rating = Number(candidate.rating || 0);
  const voteCount = Number(candidate.voteCount || 0);
  const voteScore = Math.log10(Math.max(1, voteCount)) * 1.25;
  const ratingScore = Math.max(0, rating - 5.5) * 1.6;
  return Math.min(8, voteScore + ratingScore);
}

function scoreCandidate(candidate = {}, profile = {}) {
  const genreScore = genreOverlapScore(candidate, profile.rankedGenres || []);
  const maxGenreScore = Math.max(
    1,
    ...(profile.rankedGenres || []).map((genre) => genre.score || 0),
  );
  const genrePoints = Math.min(18, (genreScore / maxGenreScore) * 18);

  const clusterScore = clusterOverlapScore(
    candidate,
    profile.clusterWeights || {},
  );
  const maxClusterScore = Math.max(
    1,
    ...Object.values(profile.clusterWeights || {}).filter((value) => value > 0),
  );
  const clusterPoints = Math.min(18, (clusterScore / maxClusterScore) * 18);

  const toneScore = toneOverlapScore(candidate, profile.toneWeights || {});
  const maxToneScore = Math.max(
    1,
    ...Object.values(profile.toneWeights || {}).filter((value) => value > 0),
  );
  const tonePoints = Math.min(14, (toneScore / maxToneScore) * 14);

  const relationshipPoints = Math.min(
    20,
    sourceRelationshipScore(candidate, profile),
  );
  const sourceCount = (candidate.sourceTitles || []).length;
  const sourceOverlap = maxSourceGenreOverlap(candidate);
  const sourceBonus = Math.min(8, Number(candidate.sourceBonus || 0) * 0.28);
  const keywordBonus =
    candidate.sourceNames?.has("taste keywords") ||
    candidate.sourceNames?.has("keyword discovery")
      ? 3.5
      : 0;
  const mediaBonus = candidate.mediaType === profile.topMediaType ? 2 : 0;
  const languageBonus =
    candidate.originalLanguage &&
    profile.topLanguages?.includes(candidate.originalLanguage)
      ? 2
      : 0;
  const decadePoints = Math.min(
    4.5,
    decadeScore(candidate, profile.decadeWeights || {}) * 0.42,
  );
  const quality = qualityPoints(candidate);

  const negativePenalty = Math.min(
    36,
    negativeGenreScore(candidate, profile.negativeGenres || []) * 2.1 +
      negativeClusterScore(candidate, profile.negativeClusterWeights || {}) *
        2.8 +
      negativeToneScore(candidate, profile.negativeToneWeights || {}) * 3.1,
  );
  const profileOverlap = profileGenreOverlapCount(
    candidate,
    profile.rankedGenres || [],
  );
  const specificOverlap = specificProfileOverlapCount(
    candidate,
    profile.rankedGenres || [],
  );
  const meaningful = meaningfulOverlapCount(candidate, profile);
  const broadOnlyPenalty =
    (candidate.tags || []).every((tag) => BROAD_GENRES.has(normalise(tag))) &&
    !sourceCount
      ? 16
      : 0;
  const weakSingleTagPenalty = meaningful < 2 && sourceOverlap < 2 ? 14 : 0;
  const noSharedSignalPenalty =
    genreScore <= 0 && clusterScore <= 0 && toneScore <= 0 && !sourceCount
      ? 18
      : 0;
  const saturationPenalty =
    profileOverlap > 0 &&
    specificOverlap === 0 &&
    clusterScore <= 0 &&
    toneScore <= 0
      ? 9
      : 0;

  const raw =
    36 +
    genrePoints +
    clusterPoints +
    tonePoints +
    relationshipPoints +
    sourceBonus +
    keywordBonus +
    mediaBonus +
    languageBonus +
    quality +
    decadePoints -
    negativePenalty -
    broadOnlyPenalty -
    weakSingleTagPenalty -
    noSharedSignalPenalty -
    saturationPenalty;
  return Math.max(42, Math.min(95, Math.round(raw)));
}

function rankingScore(candidate = {}, profile = {}) {
  const match = scoreCandidate(candidate, profile);
  const profileComponent =
    genreOverlapScore(candidate, profile.rankedGenres || []) +
    clusterOverlapScore(candidate, profile.clusterWeights || {}) +
    toneOverlapScore(candidate, profile.toneWeights || {});
  const sourceComponent =
    sourceRelationshipScore(candidate, profile) +
    Number(candidate.sourceBonus || 0);
  const penalty =
    negativeGenreScore(candidate, profile.negativeGenres || []) +
    negativeClusterScore(candidate, profile.negativeClusterWeights || {}) +
    negativeToneScore(candidate, profile.negativeToneWeights || {});
  // Light RRF-style blend: a candidate must do reasonably well in the wider taste profile and in direct seed similarity.
  const profileRank = 1 / (60 + Math.max(1, 220 - profileComponent));
  const sourceRank = 1 / (60 + Math.max(1, 160 - sourceComponent));
  return (
    match +
    profileRank * 1200 +
    sourceRank * 900 +
    qualityPoints(candidate) -
    penalty * 0.55
  );
}

async function hydrateRuntime(candidates = []) {
  const limited = candidates.slice(0, MAX_HYDRATE);
  const details = await Promise.allSettled(
    limited.map((candidate) =>
      candidate.mediaType === "tv"
        ? getTvDetails(candidate.tmdbId)
        : getMovieDetails(candidate.tmdbId),
    ),
  );

  return limited.map((candidate, index) => {
    const detail =
      details[index].status === "fulfilled" ? details[index].value : null;
    return applyRuntime(candidate, detail);
  });
}

async function fetchSeedRecommendations(seedMovies = [], genreIdMap) {
  const orderedSeeds = [...seedMovies]
    .sort((a, b) => seedWeight(b) - seedWeight(a))
    .slice(0, MAX_SEEDS);

  const requests = orderedSeeds.flatMap((seed) => {
    const id = publicTmdbId(seed);
    if (!id || !Number.isFinite(Number(id))) return [];
    const pages = [1, 2];
    if (seed.mediaType === "tv") {
      return pages.flatMap((page) => [
        getTvRecommendations(id, page).then((data) => ({
          seed,
          mediaType: "tv",
          data,
          bonus: seedWeight(seed),
          source: "seed recommendations",
        })),
        getSimilarTvShows(id, page).then((data) => ({
          seed,
          mediaType: "tv",
          data,
          bonus: seedWeight(seed) - 2,
          source: "similar titles",
        })),
      ]);
    }
    return pages.flatMap((page) => [
      getMovieRecommendations(id, page).then((data) => ({
        seed,
        mediaType: "movie",
        data,
        bonus: seedWeight(seed),
        source: "seed recommendations",
      })),
      getSimilarMovies(id, page).then((data) => ({
        seed,
        mediaType: "movie",
        data,
        bonus: seedWeight(seed) - 2,
        source: "similar titles",
      })),
    ]);
  });

  const results = await Promise.allSettled(requests);
  return results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => {
      const { seed, mediaType, data, bonus, source } = result.value;
      const names =
        mediaType === "tv" ? genreIdMap.tvNames : genreIdMap.movieNames;
      return (data?.results || []).slice(0, 18).map((item, index) => ({
        candidate: normaliseCandidate(item, mediaType, names, index),
        sourceBonus: bonus,
        sourceNames: [source],
        sourceTitle: seed.title,
        sourceGenres: seed.tags || [],
      }));
    });
}

async function fetchSeedKeywords(seedMovies = []) {
  const orderedSeeds = [...seedMovies]
    .sort((a, b) => seedWeight(b) - seedWeight(a))
    .slice(0, MAX_SEEDS);

  const requests = orderedSeeds.map((seed) => {
    const id = publicTmdbId(seed);
    if (seed.mediaType === "tv")
      return getTvKeywords(id).then((data) => ({
        seed,
        keywords: data?.results || [],
      }));
    return getMovieKeywords(id).then((data) => ({
      seed,
      keywords: data?.keywords || [],
    }));
  });

  const results = await Promise.allSettled(requests);
  const keywordWeights = new Map();
  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    const { seed, keywords } = result.value;
    const weight = seedWeight(seed);
    (keywords || [])
      .filter((keyword) => !GENERIC_KEYWORDS.has(normalise(keyword.name)))
      .forEach((keyword) => addWeight(keywordWeights, keyword.name, weight));
  });

  return [...keywordWeights.values()]
    .filter((keyword) => keyword.score > 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

async function keywordIdsForTerms(terms = []) {
  const cleanTerms = [...new Set(terms.map(cleanLabel).filter(Boolean))].slice(
    0,
    14,
  );
  const results = await Promise.allSettled(
    cleanTerms.map((term) =>
      searchTmdbKeywords(term, 1).then((data) => ({ term, data })),
    ),
  );

  return results
    .filter((result) => result.status === "fulfilled")
    .map((result) => {
      const { term, data } = result.value;
      const exact = (data?.results || []).find(
        (keyword) => normalise(keyword.name) === normalise(term),
      );
      const fallback = (data?.results || [])[0];
      return exact || fallback;
    })
    .filter(Boolean)
    .filter((keyword) => !GENERIC_KEYWORDS.has(normalise(keyword.name)))
    .slice(0, 10);
}

function keywordTermsForProfile(profile = {}) {
  const clusterTerms = topClusterNames(profile, 5).flatMap((cluster) => {
    if (cluster === "animationAnime") return ["anime", "based on manga"];
    if (cluster === "fantasyAdventure") return ["magic", "supernatural power"];
    if (cluster === "horrorThriller") return ["slasher", "supernatural horror"];
    if (cluster === "sciFiSpace") return ["space opera", "alien"];
    if (cluster === "superheroComic") return ["superhero", "based on comic"];
    if (cluster === "mysteryCrime") return ["detective", "whodunit"];
    if (cluster === "cerebralSciFi")
      return ["mind bending", "time travel", "artificial intelligence"];
    if (cluster === "socialThriller")
      return ["social satire", "psychological thriller"];
    return [];
  });
  return [
    ...new Set([
      ...(profile.rankedKeywords || []).map((keyword) => keyword.label),
      ...clusterTerms,
    ]),
  ];
}

async function fetchProfileDiscoverCandidates(
  profile = {},
  genreIdMap,
  genreFilter = "All",
) {
  const requests = [];
  const movieGenreIds = topGenreIds(profile, genreIdMap, "movie");
  const tvGenreIds = topGenreIds(profile, genreIdMap, "tv");
  const filterMovieGenreId = genreIdForLabel(genreFilter, genreIdMap, "movie");
  const filterTvGenreId = genreIdForLabel(genreFilter, genreIdMap, "tv");
  const hasGenreFilter = Boolean(
    normalise(genreFilter) && normalise(genreFilter) !== "all",
  );

  function pushMovie(
    params,
    bonus = 5,
    source = "preferred genres",
    keywordNames = [],
  ) {
    [1, 2].forEach((page) =>
      requests.push(
        discoverMovies({
          page,
          sort_by: "popularity.desc",
          vote_average_gte: 5.5,
          vote_count_gte: 20,
          ...params,
        }).then((data) => ({
          mediaType: "movie",
          data,
          source,
          bonus,
          keywordNames,
        })),
      ),
    );
  }

  function pushTv(
    params,
    bonus = 5,
    source = "preferred genres",
    keywordNames = [],
  ) {
    [1, 2].forEach((page) =>
      requests.push(
        discoverTvShows({
          page,
          sort_by: "popularity.desc",
          vote_average_gte: 5.5,
          vote_count_gte: 15,
          ...params,
        }).then((data) => ({
          mediaType: "tv",
          data,
          source,
          bonus,
          keywordNames,
        })),
      ),
    );
  }

  if (hasGenreFilter) {
    if (filterMovieGenreId) {
      pushMovie(
        { with_genres: String(filterMovieGenreId) },
        9,
        `${genreFilter} genre match`,
      );
      movieGenreIds.slice(0, 4).forEach((id) => {
        if (id !== filterMovieGenreId)
          pushMovie(
            { with_genres: `${filterMovieGenreId},${id}` },
            11,
            `${genreFilter} + taste profile`,
          );
      });
    }
    if (filterTvGenreId) {
      pushTv(
        { with_genres: String(filterTvGenreId) },
        9,
        `${genreFilter} genre match`,
      );
      tvGenreIds.slice(0, 4).forEach((id) => {
        if (id !== filterTvGenreId)
          pushTv(
            { with_genres: `${filterTvGenreId},${id}` },
            11,
            `${genreFilter} + taste profile`,
          );
      });
    }
  }

  movieGenreIds.slice(0, 5).forEach((id) => {
    const label = Object.values(genreIdMap.movieNames).find(
      (name) => genreIdMap.movie.get(normalise(name)) === id,
    );
    pushMovie(
      { with_genres: String(id) },
      BROAD_GENRES.has(normalise(label)) ? 2 : 5,
    );
  });
  tvGenreIds.slice(0, 5).forEach((id) => {
    const label = Object.values(genreIdMap.tvNames).find(
      (name) => genreIdMap.tv.get(normalise(name)) === id,
    );
    pushTv(
      { with_genres: String(id) },
      BROAD_GENRES.has(normalise(label)) ? 2 : 5,
    );
  });

  for (
    let index = 0;
    index < Math.min(3, movieGenreIds.length - 1);
    index += 1
  ) {
    pushMovie(
      { with_genres: `${movieGenreIds[index]},${movieGenreIds[index + 1]}` },
      7,
    );
  }
  for (let index = 0; index < Math.min(3, tvGenreIds.length - 1); index += 1) {
    pushTv({ with_genres: `${tvGenreIds[index]},${tvGenreIds[index + 1]}` }, 7);
  }

  const keywordIds = await keywordIdsForTerms(keywordTermsForProfile(profile));
  keywordIds.slice(0, 6).forEach((keyword) => {
    pushMovie({ with_keywords: String(keyword.id) }, 6, "taste keywords", [
      keyword.name,
    ]);
    pushTv({ with_keywords: String(keyword.id) }, 6, "taste keywords", [
      keyword.name,
    ]);
  });

  const results = await Promise.allSettled(requests);
  return results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => {
      const {
        mediaType,
        data,
        bonus,
        source,
        keywordNames = [],
      } = result.value;
      const names =
        mediaType === "tv" ? genreIdMap.tvNames : genreIdMap.movieNames;
      return (data?.results || []).slice(0, 20).map((item, index) => ({
        candidate: normaliseCandidate(item, mediaType, names, index),
        sourceBonus: bonus,
        sourceNames: [source],
        keywordNames,
      }));
    });
}

function curatedTermsForProfile(profile = {}) {
  const terms = [];
  topClusterNames(profile, 5).forEach((cluster) => {
    const clusterTerms = CURATED_BY_CLUSTER[cluster] || [];
    terms.push(...clusterTerms.slice(0, 3));
  });
  return [...new Set(terms)].slice(0, 12);
}

async function fetchCuratedSearchCandidates(profile = {}, genreIdMap) {
  const terms = curatedTermsForProfile(profile);
  const results = await Promise.allSettled(
    terms.map((term) =>
      searchMultiTitles(term, 1).then((data) => ({ term, data })),
    ),
  );

  return results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => {
      const { term, data } = result.value;
      return (data?.results || [])
        .filter(
          (item) => item.media_type === "movie" || item.media_type === "tv",
        )
        .slice(0, 2)
        .map((item, index) => {
          const mediaType = item.media_type;
          const names =
            mediaType === "tv" ? genreIdMap.tvNames : genreIdMap.movieNames;
          return {
            candidate: normaliseCandidate(item, mediaType, names, index),
            sourceBonus: 7,
            sourceNames: ["close title search"],
            searchTerms: [term],
          };
        });
    });
}

function shouldKeepCandidate(candidate, profile = {}, relaxed = false) {
  if (!hasEnoughQuality(candidate, relaxed)) return false;
  const genreScore = genreOverlapScore(candidate, profile.rankedGenres || []);
  const clusterScore = clusterOverlapScore(
    candidate,
    profile.clusterWeights || {},
  );
  const toneScore = toneOverlapScore(candidate, profile.toneWeights || {});
  const hasSource = (candidate.sourceTitles || []).length > 0;
  const sourceCandidate =
    candidate.sourceNames?.has("seed recommendations") ||
    candidate.sourceNames?.has("similar titles");
  const profileOverlap = profileGenreOverlapCount(
    candidate,
    profile.rankedGenres || [],
  );
  const specificOverlap = specificProfileOverlapCount(
    candidate,
    profile.rankedGenres || [],
  );
  const sourceOverlap = maxSourceGenreOverlap(candidate);
  const hasSpecificSource = hasSpecificSharedSourceGenre(candidate);
  const meaningful = meaningfulOverlapCount(candidate, profile);
  const negativeScore =
    negativeGenreScore(candidate, profile.negativeGenres || []) +
    negativeClusterScore(candidate, profile.negativeClusterWeights || {}) +
    negativeToneScore(candidate, profile.negativeToneWeights || {});
  const positiveScore =
    genreScore +
    clusterScore +
    toneScore +
    sourceRelationshipScore(candidate, profile);

  if (negativeScore > positiveScore * 0.72) return false;

  const { goodFit: goodSourceFit } = sourceFitDetails(candidate, profile);
  // Avoid weak recommendations that only share broad/surface tags with a seed, such as Animation/Family only.
  if (sourceCandidate && !goodSourceFit) return false;

  if (hasSource && (goodSourceFit || (hasSpecificSource && meaningful >= 3)))
    return true;
  if (sourceCandidate && relaxed && goodSourceFit) return true;
  if (
    profileOverlap >= 2 &&
    meaningful >= 2 &&
    (specificOverlap >= 1 || clusterScore >= 4 || toneScore > 0)
  )
    return true;
  if (specificOverlap >= 1 && (toneScore > 0 || clusterScore >= 4)) return true;
  return false;
}

function diversifyRecommendations(
  candidates = [],
  limit = DEFAULT_LIMIT,
  profile = {},
) {
  const selected = [];
  const clusterCounts = new Map();
  const mediaCounts = new Map();
  const clusterScores = Object.values(profile.clusterWeights || {}).filter(
    (value) => value > 0,
  );
  const totalClusterScore =
    clusterScores.reduce((sum, score) => sum + score, 0) || 1;
  const strongestClusterShare =
    Math.max(0, ...clusterScores) / totalClusterScore;
  const maxPerCluster =
    strongestClusterShare > 0.6
      ? Math.ceil(limit * 0.5)
      : Math.ceil(limit * 0.36);
  const hasMixedMediaTaste =
    Object.keys(profile.mediaTypeWeights || {}).length > 1;
  const maxPerMedia = hasMixedMediaTaste ? Math.ceil(limit * 0.72) : limit;
  const coreLimit = Math.max(1, Math.floor(limit * 0.86));

  candidates.forEach((candidate) => {
    if (selected.length >= coreLimit) return;
    const cluster = candidatePrimaryCluster(candidate, profile);
    const mediaType = candidate.mediaType || "movie";
    if ((clusterCounts.get(cluster) || 0) >= maxPerCluster) return;
    if ((mediaCounts.get(mediaType) || 0) >= maxPerMedia) return;
    selected.push(candidate);
    clusterCounts.set(cluster, (clusterCounts.get(cluster) || 0) + 1);
    mediaCounts.set(mediaType, (mediaCounts.get(mediaType) || 0) + 1);
  });

  // Reserve a small discovery gap: only titles with one strong cluster/tone connection can fill it.
  candidates.forEach((candidate) => {
    if (selected.length >= limit) return;
    if (
      selected.some(
        (item) => interactionKey(item) === interactionKey(candidate),
      )
    )
      return;
    if (meaningfulOverlapCount(candidate, profile) < 2) return;
    selected.push(candidate);
  });

  if (selected.length < limit) {
    candidates.forEach((candidate) => {
      if (selected.length >= limit) return;
      if (
        selected.some(
          (item) => interactionKey(item) === interactionKey(candidate),
        )
      )
        return;
      selected.push(candidate);
    });
  }

  return selected.slice(0, limit);
}

export async function getContentBasedRecommendations(userId, options = {}) {
  if (!userId)
    return {
      recommendations: [],
      topMatches: [],
      profile: null,
      message: "Log in to build personalised recommendations.",
    };

  const limit = Math.max(3, Number(options.limit || DEFAULT_LIMIT));
  const genreFilter = cleanLabel(options.genreFilter || "All");
  const hasGenreFilter = Boolean(
    normalise(genreFilter) && normalise(genreFilter) !== "all",
  );
  const [
    favourites,
    watchStates,
    ratings,
    feedbackRows,
    movieGenres,
    tvGenres,
  ] = await Promise.all([
    listUserFavourites(userId),
    listUserWatchStates(userId),
    listUserRatings(userId),
    listRecommendationFeedback(userId),
    getMovieGenres(),
    getTvGenres(),
  ]);

  const genreIdMap = buildGenreIdMap(movieGenres, tvGenres);
  const genreWeights = new Map();
  const negativeGenreWeights = new Map();
  const clusterWeights = new Map();
  const negativeClusterWeights = new Map();
  const toneWeights = new Map();
  const negativeToneWeights = new Map();
  const decadeWeights = new Map();
  const languageWeights = new Map();
  const mediaTypeWeights = new Map();
  const excluded = new Set();
  const seedMovies = [];
  const activityKeys = new Set();

  function rememberActivity(movie) {
    if (movie?.tmdbId) activityKeys.add(interactionKey(movie));
  }

  function addPositive(
    movie,
    {
      weight = 1,
      source = "activity",
      exclude = true,
      seed = true,
      signalWeight = null,
    } = {},
  ) {
    if (!movie?.tmdbId) return;
    const adjustedWeight = weight * recencyMultiplier(movie.createdAt);
    rememberActivity(movie);
    if (exclude) excluded.add(interactionKey(movie));
    if (seed)
      seedMovies.push(
        createSeed(movie, source, signalWeight || adjustedWeight),
      );
    (movie.tags || []).forEach((genre) =>
      addWeight(
        genreWeights,
        genre,
        weightedGenrePoints(genre, adjustedWeight),
      ),
    );
    addNumberWeight(languageWeights, movie.originalLanguage, adjustedWeight);
    addNumberWeight(mediaTypeWeights, movie.mediaType, adjustedWeight);
    addClusterWeights(clusterWeights, movie, adjustedWeight);
    addToneWeights(toneWeights, movie, adjustedWeight);
    addDecadeWeights(decadeWeights, movie, adjustedWeight);
  }

  function addNegative(movie, weight = 1) {
    if (!movie?.tmdbId) return;
    const adjustedWeight = weight * recencyMultiplier(movie.createdAt);
    rememberActivity(movie);
    excluded.add(interactionKey(movie));
    (movie.tags || []).forEach((genre) =>
      addWeight(
        negativeGenreWeights,
        genre,
        weightedGenrePoints(genre, adjustedWeight),
      ),
    );
    clusterVector(movie).forEach((cluster) =>
      addNumberWeight(
        negativeClusterWeights,
        cluster,
        -Math.abs(adjustedWeight),
      ),
    );
    toneVector(movie).forEach((tone) =>
      addNumberWeight(negativeToneWeights, tone, -Math.abs(adjustedWeight)),
    );
  }

  favourites.forEach((item) =>
    addPositive(normaliseInteractionMovie(item), {
      weight: 5.5,
      source: "favourites",
    }),
  );

  watchStates.forEach((item) => {
    const movie = normaliseInteractionMovie(item, {
      genre: item.status || "Watch Status",
    });
    const status = normalise(item.status);
    if (status === "watched")
      addPositive(movie, { weight: 3.4, source: "watched" });
    if (status === "watching")
      addPositive(movie, { weight: 3.2, source: "watching" });
    if (status === "wishlist")
      addPositive(movie, { weight: 2.1, source: "wishlist" });
    if (status === "not interested" || status === "not_interested")
      addNegative(movie, 9);
  });

  feedbackRows.forEach((row) => {
    const movie = normaliseInteractionMovie(row, { genre: "Not Interested" });
    if (normalise(row.feedback_type) === "not_interested")
      addNegative(movie, 12);
  });

  ratings.forEach((row) => {
    const movie = normaliseInteractionMovie(row, { genre: "Rated" });
    const value = Number(row.rating_value || row.rating || 0);
    rememberActivity(movie);
    if (value >= 5)
      addPositive(movie, { weight: 9.5, source: "ratings", signalWeight: 19 });
    else if (value >= 4)
      addPositive(movie, { weight: 6.4, source: "ratings", signalWeight: 14 });
    else if (value === 3)
      addPositive(movie, { weight: 1.1, source: "ratings", signalWeight: 4 });
    else if (value > 0) addNegative(movie, 6 + (3 - value) * 2.8);
  });

  const activityCount = activityKeys.size;
  const rankedKeywords = await fetchSeedKeywords(seedMovies);
  const rankedGenres = [...genreWeights.values()]
    .filter((genre) => genre.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 10);

  const negativeGenres = [...negativeGenreWeights.values()]
    .filter((genre) => genre.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const topLanguages = [...languageWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([language]) => language)
    .filter((language) => language)
    .slice(0, 3);

  const topMediaType =
    [...mediaTypeWeights.entries()].sort((a, b) => b[1] - a[1])?.[0]?.[0] ||
    "movie";
  const clusterWeightObject = Object.fromEntries(clusterWeights.entries());
  const negativeClusterWeightObject = Object.fromEntries(
    negativeClusterWeights.entries(),
  );
  const toneWeightObject = Object.fromEntries(toneWeights.entries());
  const negativeToneWeightObject = Object.fromEntries(
    negativeToneWeights.entries(),
  );
  const decadeWeightObject = Object.fromEntries(decadeWeights.entries());
  const mediaTypeWeightObject = Object.fromEntries(mediaTypeWeights.entries());

  const profileForScoring = {
    rankedGenres,
    negativeGenres,
    rankedKeywords,
    topLanguages,
    topMediaType,
    mediaTypeWeights: mediaTypeWeightObject,
    clusterWeights: clusterWeightObject,
    negativeClusterWeights: negativeClusterWeightObject,
    toneWeights: toneWeightObject,
    negativeToneWeights: negativeToneWeightObject,
    decadeWeights: decadeWeightObject,
    seedMovies,
  };

  const profile = {
    topGenres: rankedGenres,
    topKeywords: rankedKeywords,
    topLanguages,
    topMediaType,
    activeClusters: topClusterNames(profileForScoring),
    clusters: clusterWeightObject,
    tones: toneWeightObject,
    signals: {
      favourites: favourites.length,
      ratings: ratings.length,
      watched: watchStates.filter(
        (item) => normalise(item.status) === "watched",
      ).length,
      watchStates: watchStates.length,
      activityCount,
    },
  };

  if (activityCount < MIN_ACTIVITY_ITEMS || !rankedGenres.length) {
    return {
      recommendations: [],
      topMatches: [],
      profile,
      message: `Add at least ${MIN_ACTIVITY_ITEMS} movies or TV shows to favourites, ratings, or watch status to build personalised recommendations.`,
    };
  }

  const candidateMap = new Map();
  const [seedCandidates, profileCandidates] = await Promise.all([
    fetchSeedRecommendations(seedMovies, genreIdMap),
    fetchProfileDiscoverCandidates(profileForScoring, genreIdMap, genreFilter),
  ]);

  [...seedCandidates, ...profileCandidates].forEach(
    ({
      candidate,
      sourceBonus,
      sourceNames,
      keywordNames,
      searchTerms,
      sourceTitle,
      sourceGenres,
    }) => {
      if (!candidate?.tmdbId) return;
      if (excluded.has(interactionKey(candidate))) return;
      if (hasGenreFilter && !candidateHasGenre(candidate, genreFilter)) return;
      mergeCandidate(candidateMap, candidate, {
        sourceBonus,
        sourceNames,
        keywordNames,
        searchTerms,
        sourceTitle,
        sourceGenres,
      });
    },
  );

  if (candidateMap.size < limit) {
    const curatedCandidates = await fetchCuratedSearchCandidates(
      profileForScoring,
      genreIdMap,
    );
    curatedCandidates.forEach(
      ({
        candidate,
        sourceBonus,
        sourceNames,
        keywordNames,
        searchTerms,
        sourceTitle,
        sourceGenres,
      }) => {
        if (!candidate?.tmdbId) return;
        if (excluded.has(interactionKey(candidate))) return;
        if (hasGenreFilter && !candidateHasGenre(candidate, genreFilter))
          return;
        mergeCandidate(candidateMap, candidate, {
          sourceBonus: Math.min(4, sourceBonus || 0),
          sourceNames,
          keywordNames,
          searchTerms,
          sourceTitle,
          sourceGenres,
        });
      },
    );
  }

  let scored = [...candidateMap.values()]
    .filter((candidate) =>
      shouldKeepCandidate(candidate, profileForScoring, true),
    )
    .map((candidate) => ({
      ...candidate,
      matchPercent: scoreCandidate(candidate, profileForScoring),
      reason: candidateReason(candidate, profileForScoring),
      personalMessage: candidatePersonalMessage(candidate, profileForScoring),
    }))
    .sort(
      (a, b) =>
        rankingScore(b, profileForScoring) -
          rankingScore(a, profileForScoring) ||
        b.matchPercent - a.matchPercent ||
        (b.sourceTitles?.length || 0) - (a.sourceTitles?.length || 0) ||
        Number(b.voteCount || 0) - Number(a.voteCount || 0),
    );

  if (!scored.length) {
    scored = [...candidateMap.values()]
      .filter((candidate) => hasEnoughQuality(candidate, true))
      .map((candidate) => ({
        ...candidate,
        matchPercent: scoreCandidate(candidate, profileForScoring),
        reason: candidateReason(candidate, profileForScoring),
        personalMessage: candidatePersonalMessage(candidate, profileForScoring),
      }))
      .sort(
        (a, b) =>
          rankingScore(b, profileForScoring) -
            rankingScore(a, profileForScoring) ||
          b.matchPercent - a.matchPercent ||
          Number(b.voteCount || 0) - Number(a.voteCount || 0),
      );
  }

  if (scored.length < limit) {
    const existingKeys = new Set(scored.map(interactionKey));
    const relaxedFallback = [...candidateMap.values()]
      .filter((candidate) => !existingKeys.has(interactionKey(candidate)))
      .filter(
        (candidate) =>
          !hasGenreFilter || candidateHasGenre(candidate, genreFilter),
      )
      .filter((candidate) => hasEnoughQuality(candidate, true))
      .filter((candidate) => {
        const positiveScore =
          genreOverlapScore(candidate, profileForScoring.rankedGenres || []) +
          clusterOverlapScore(
            candidate,
            profileForScoring.clusterWeights || {},
          ) +
          toneOverlapScore(candidate, profileForScoring.toneWeights || {}) +
          sourceRelationshipScore(candidate, profileForScoring);
        const negativeScore =
          negativeGenreScore(
            candidate,
            profileForScoring.negativeGenres || [],
          ) +
          negativeClusterScore(
            candidate,
            profileForScoring.negativeClusterWeights || {},
          ) +
          negativeToneScore(
            candidate,
            profileForScoring.negativeToneWeights || {},
          );
        const profileOverlap = profileGenreOverlapCount(
          candidate,
          profileForScoring.rankedGenres || [],
        );
        const meaningful = meaningfulOverlapCount(candidate, profileForScoring);
        const hasSeedLink = (candidate.sourceTitles || []).length > 0;
        const { goodFit: goodSourceFit } = sourceFitDetails(
          candidate,
          profileForScoring,
        );
        if (hasSeedLink && !goodSourceFit) return false;
        return (
          negativeScore <= positiveScore * 0.86 &&
          (meaningful >= 2 || profileOverlap >= 2 || goodSourceFit)
        );
      })
      .map((candidate) => ({
        ...candidate,
        matchPercent: scoreCandidate(candidate, profileForScoring),
        reason: candidateReason(candidate, profileForScoring),
        personalMessage: candidatePersonalMessage(candidate, profileForScoring),
      }))
      .sort(
        (a, b) =>
          rankingScore(b, profileForScoring) -
            rankingScore(a, profileForScoring) ||
          b.matchPercent - a.matchPercent ||
          (b.sourceTitles?.length || 0) - (a.sourceTitles?.length || 0) ||
          Number(b.voteCount || 0) - Number(a.voteCount || 0),
      );
    scored = [...scored, ...relaxedFallback].slice(0, Math.max(limit * 2, 24));
  }

  const diversified = diversifyRecommendations(
    scored,
    Math.max(limit * 2, 24),
    profileForScoring,
  );
  const hydratedCandidates = await hydrateRuntime(diversified);
  const recommendations = diversifyRecommendations(
    hydratedCandidates
      .map((candidate) => ({
        ...candidate,
        matchPercent: scoreCandidate(candidate, profileForScoring),
        reason: candidateReason(candidate, profileForScoring),
        personalMessage: candidatePersonalMessage(candidate, profileForScoring),
      }))
      .sort(
        (a, b) =>
          rankingScore(b, profileForScoring) -
            rankingScore(a, profileForScoring) ||
          b.matchPercent - a.matchPercent ||
          (b.sourceTitles?.length || 0) - (a.sourceTitles?.length || 0) ||
          Number(b.voteCount || 0) - Number(a.voteCount || 0),
      ),
    limit,
    profileForScoring,
  );

  return {
    recommendations,
    topMatches: recommendations.slice(0, 3),
    profile,
    message: recommendations.length
      ? ""
      : "Add a wider mix of favourites, ratings, or watch status to improve your recommendations.",
  };
}
