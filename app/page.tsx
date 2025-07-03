"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ExternalLink, BookOpen, Users, Calendar, Loader2, Heart, Share2, Bookmark, ArrowDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"

interface Author {
  name: string
}

interface Article {
  id: string
  title: string
  authors: Author[]
  abstract: string
  url: string
  year: number
  source: "semantic" | "arxiv"
}

interface UserPreferences {
  likedArticles: string[]
  savedArticles: string[]
  likedTopics: { [key: string]: number }
}

const SEARCH_TERMS = [
  "science",
  "biology",
  "ai",
  "data",
  "physics",
  "chemistry",
  "technology",
  "research",
  "machine learning",
  "neuroscience",
  "mathematics",
  "computer science",
  "psychology",
  "medicine",
  "engineering",
]

export default function SciTokApp() {
  const [articles, setArticles] = useState<Article[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // User preferences
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    likedArticles: [],
    savedArticles: [],
    likedTopics: {},
  })

  // Cache para evitar requisições repetidas
  const [cache, setCache] = useState<Map<string, Article[]>>(new Map())
  const [usedCacheKeys, setUsedCacheKeys] = useState<Set<string>>(new Set())

  // Load user preferences
  useEffect(() => {
    const saved = localStorage.getItem("scitok-preferences")
    if (saved) {
      setUserPreferences(JSON.parse(saved))
    }
  }, [])

  // Save user preferences
  const savePreferences = useCallback((newPreferences: UserPreferences) => {
    setUserPreferences(newPreferences)
    localStorage.setItem("scitok-preferences", JSON.stringify(newPreferences))
  }, [])

  // Get recommended search terms based on user preferences
  const getRecommendedTerms = useCallback(() => {
    const topicScores = userPreferences.likedTopics
    const sortedTopics = Object.entries(topicScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic]) => topic)

    return sortedTopics.length > 0 ? [...sortedTopics, ...SEARCH_TERMS] : SEARCH_TERMS
  }, [userPreferences.likedTopics])

  const fetchArticles = useCallback(async () => {
    if (loading) return

    setLoading(true)

    try {
      const recommendedTerms = getRecommendedTerms()
      let newArticles: Article[] = []
      let attempts = 0
      const maxAttempts = 3

      while (newArticles.length === 0 && attempts < maxAttempts) {
        const term = recommendedTerms[Math.floor(Math.random() * recommendedTerms.length)]
        const offset = Math.floor(Math.random() * 1000)
        const cacheKey = `${term}-${offset}`

        if (usedCacheKeys.has(cacheKey)) {
          attempts++
          continue
        }

        if (cache.has(cacheKey)) {
          const cachedArticles = cache.get(cacheKey)!
          newArticles = cachedArticles
          break
        }

        const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${term}&offset=${offset}&limit=15&fields=title,authors,abstract,url,year,paperId`

        try {
          const response = await fetch(url)
          const data = await response.json()

          if (data.data && data.data.length > 0) {
            const fetchedArticles: Article[] = data.data
              .filter((paper: any) => paper.abstract && paper.title && paper.abstract.length > 100)
              .map((paper: any) => ({
                id: paper.paperId || `${Date.now()}-${Math.random()}`,
                title: paper.title,
                authors: paper.authors || [],
                abstract: paper.abstract,
                url: paper.url || "#",
                year: paper.year || new Date().getFullYear(),
                source: "semantic" as const,
              }))

            if (fetchedArticles.length > 0) {
              newArticles = fetchedArticles
              setCache((prev) => new Map(prev).set(cacheKey, newArticles))
              setUsedCacheKeys((prev) => new Set(prev).add(cacheKey))
              localStorage.setItem(`scitok-${cacheKey}`, JSON.stringify(newArticles))
            }
          }
        } catch (error) {
          console.error(`Erro na tentativa ${attempts + 1}:`, error)
        }

        attempts++
      }

      if (newArticles.length > 0) {
        setArticles((prev) => {
          const existingIds = new Set(prev.map((article) => article.id))
          const uniqueNewArticles = newArticles.filter((article) => !existingIds.has(article.id))
          return [...prev, ...uniqueNewArticles]
        })
      }
    } catch (error) {
      console.error("Erro geral ao buscar artigos:", error)
    } finally {
      setLoading(false)
    }
  }, [loading, cache, usedCacheKeys, getRecommendedTerms])

  // Carregar artigos iniciais
  useEffect(() => {
    fetchArticles()
  }, [])

  // Carregar mais artigos quando necessário
  useEffect(() => {
    if (articles.length - currentIndex <= 3 && !loading) {
      fetchArticles()
    }
  }, [currentIndex, articles.length, fetchArticles, loading])

  // Sistema de scroll simplificado (corrigido)
  useEffect(() => {
    let isProcessing = false

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      if (isProcessing) return
      isProcessing = true

      if (e.deltaY > 0 && currentIndex < articles.length - 1) {
        setCurrentIndex((prev) => prev + 1)
      } else if (e.deltaY < 0 && currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1)
      }

      // Reset após animação
      setTimeout(() => {
        isProcessing = false
      }, 300)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProcessing) return
      isProcessing = true

      if (e.key === "ArrowDown" && currentIndex < articles.length - 1) {
        setCurrentIndex((prev) => prev + 1)
      } else if (e.key === "ArrowUp" && currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1)
      }

      setTimeout(() => {
        isProcessing = false
      }, 300)
    }

    // Touch events simplificados
    let touchStartY = 0

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (isProcessing) return

      const touchEndY = e.changedTouches[0].clientY
      const diff = touchStartY - touchEndY

      if (Math.abs(diff) > 50) {
        isProcessing = true

        if (diff > 0 && currentIndex < articles.length - 1) {
          setCurrentIndex((prev) => prev + 1)
        } else if (diff < 0 && currentIndex > 0) {
          setCurrentIndex((prev) => prev - 1)
        }

        setTimeout(() => {
          isProcessing = false
        }, 300)
      }
    }

    window.addEventListener("wheel", handleWheel, { passive: false })
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("touchstart", handleTouchStart, { passive: true })
    window.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener("wheel", handleWheel)
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("touchstart", handleTouchStart)
      window.removeEventListener("touchend", handleTouchEnd)
    }
  }, [currentIndex, articles.length])

  // Modo escuro
  useEffect(() => {
    const savedMode = localStorage.getItem("scitok-dark-mode")
    if (savedMode) {
      setDarkMode(JSON.parse(savedMode))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("scitok-dark-mode", JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [darkMode])

  // Social functions
  const handleLike = useCallback(
    (article: Article) => {
      const isLiked = userPreferences.likedArticles.includes(article.id)

      const newLikedArticles = isLiked
        ? userPreferences.likedArticles.filter((id) => id !== article.id)
        : [...userPreferences.likedArticles, article.id]

      // Update topic preferences
      const newLikedTopics = { ...userPreferences.likedTopics }

      if (!isLiked) {
        // Extract topics from title and abstract
        const text = `${article.title} ${article.abstract}`.toLowerCase()
        SEARCH_TERMS.forEach((term) => {
          if (text.includes(term.toLowerCase())) {
            newLikedTopics[term] = (newLikedTopics[term] || 0) + 1
          }
        })
      }

      const newPreferences = {
        ...userPreferences,
        likedArticles: newLikedArticles,
        likedTopics: newLikedTopics,
      }

      savePreferences(newPreferences)

      toast({
        title: isLiked ? "Descurtido!" : "Curtido!",
        description: isLiked ? "Artigo removido dos favoritos" : "Artigo adicionado aos favoritos",
      })
    },
    [userPreferences, savePreferences],
  )

  const handleSave = useCallback(
    (article: Article) => {
      const isSaved = userPreferences.savedArticles.includes(article.id)

      const newSavedArticles = isSaved
        ? userPreferences.savedArticles.filter((id) => id !== article.id)
        : [...userPreferences.savedArticles, article.id]

      const newPreferences = {
        ...userPreferences,
        savedArticles: newSavedArticles,
      }

      savePreferences(newPreferences)

      // Save full article data
      if (!isSaved) {
        localStorage.setItem(`scitok-saved-${article.id}`, JSON.stringify(article))
      } else {
        localStorage.removeItem(`scitok-saved-${article.id}`)
      }

      toast({
        title: isSaved ? "Removido!" : "Salvo!",
        description: isSaved ? "Artigo removido da lista de leitura" : "Artigo salvo para ler depois",
      })
    },
    [userPreferences, savePreferences],
  )

  const handleShare = useCallback((article: Article) => {
    // Generate APA 6th edition citation
    const authors =
      article.authors.length > 0
        ? article.authors.length === 1
          ? `${article.authors[0].name}`
          : article.authors.length === 2
            ? `${article.authors[0].name} & ${article.authors[1].name}`
            : `${article.authors[0].name} et al.`
        : "Unknown Author"

    const citation = `${authors} (${article.year}). ${article.title}. Retrieved from ${article.url !== "#" ? article.url : "Semantic Scholar"}`

    // Copy to clipboard
    navigator.clipboard
      .writeText(citation)
      .then(() => {
        toast({
          title: "Citação copiada!",
          description: "Citação APA copiada para a área de transferência",
        })
      })
      .catch(() => {
        toast({
          title: "Erro ao copiar",
          description: "Não foi possível copiar a citação",
          variant: "destructive",
        })
      })
  }, [])

  const goToNext = () => {
    if (currentIndex < articles.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const getSavedArticles = useCallback(() => {
    return userPreferences.savedArticles
      .map((id) => {
        const saved = localStorage.getItem(`scitok-saved-${id}`)
        return saved ? JSON.parse(saved) : null
      })
      .filter(Boolean)
  }, [userPreferences.savedArticles])

  if (articles.length === 0 && loading) {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-purple-200 border-t-white rounded-full animate-spin mx-auto mb-6"></div>
            <BookOpen className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">SciTok</h2>
          <p className="text-purple-200">Carregando descobertas científicas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header flutuante */}
      <header className="absolute top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <BookOpen className="h-8 w-8 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-pink-500 to-violet-500 rounded-full animate-pulse"></div>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
              SciTok
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSaved(true)}
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full relative"
            >
              <Bookmark className="h-5 w-5" />
              {userPreferences.savedArticles.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {userPreferences.savedArticles.length}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Container principal com todos os artigos */}
      <div
        ref={containerRef}
        className="h-full"
        style={{
          transform: `translateY(-${currentIndex * 100}vh)`,
          transition: "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
      >
        {articles.map((article, index) => {
          const isLiked = userPreferences.likedArticles.includes(article.id)
          const isSaved = userPreferences.savedArticles.includes(article.id)

          return (
            <div
              key={article.id}
              className="h-screen flex items-center justify-center p-4 pt-20"
              style={{ minHeight: "100vh" }}
            >
              <Card className="w-full max-w-4xl h-[85vh] bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
                <CardContent className="h-full p-0 relative overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: `linear-gradient(135deg, 
                        hsl(${(index * 60) % 360}, 70%, 50%) 0%, 
                        hsl(${(index * 60 + 120) % 360}, 70%, 40%) 100%)`,
                    }}
                  ></div>

                  <div className="relative h-full flex flex-col p-8">
                    <div className="flex-none mb-6">
                      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
                        {article.title}
                      </h2>

                      <div className="flex flex-wrap items-center gap-4 text-purple-200">
                        {article.authors.length > 0 && (
                          <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
                            <Users className="h-4 w-4" />
                            <span className="text-sm">
                              {article.authors
                                .slice(0, 2)
                                .map((a) => a.name)
                                .join(", ")}
                              {article.authors.length > 2 && ` +${article.authors.length - 2}`}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm">{article.year}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto mb-6">
                      <div className="bg-white/5 rounded-2xl p-6 backdrop-blur-sm border border-white/10">
                        <p className="text-white/90 leading-relaxed text-base md:text-lg">{article.abstract}</p>
                      </div>
                    </div>

                    <div className="flex-none space-y-4">
                      <div className="flex items-center justify-center gap-3 md:gap-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLike(article)}
                          className={`rounded-full border backdrop-blur-sm px-4 py-2 transition-all ${
                            isLiked
                              ? "bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-400/30"
                              : "bg-white/10 hover:bg-white/20 text-white border-white/20"
                          }`}
                        >
                          <Heart className={`h-4 w-4 mr-2 ${isLiked ? "fill-current" : ""}`} />
                          <span className="hidden sm:inline">{isLiked ? "Curtido" : "Curtir"}</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSave(article)}
                          className={`rounded-full border backdrop-blur-sm px-4 py-2 transition-all ${
                            isSaved
                              ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-400/30"
                              : "bg-white/10 hover:bg-white/20 text-white border-white/20"
                          }`}
                        >
                          <Bookmark className={`h-4 w-4 mr-2 ${isSaved ? "fill-current" : ""}`} />
                          <span className="hidden sm:inline">{isSaved ? "Salvo" : "Salvar"}</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShare(article)}
                          className="rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm px-4 py-2"
                        >
                          <Share2 className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Citar</span>
                        </Button>
                      </div>

                      {article.url && article.url !== "#" && (
                        <Button
                          asChild
                          size="lg"
                          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-2xl py-4 text-lg font-semibold shadow-lg"
                        >
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-3"
                          >
                            <ExternalLink className="h-5 w-5" />
                            Ler artigo completo
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>

      {/* Indicadores laterais */}
      <div className="fixed right-4 md:right-6 top-1/2 transform -translate-y-1/2 z-40 space-y-4">
        <div className="bg-black/30 backdrop-blur-md rounded-full p-3 border border-white/20">
          <div className="text-white text-sm font-medium">
            {currentIndex + 1}/{articles.length}
          </div>
        </div>

        <div className="space-y-2">
          <Button
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            size="sm"
            className="rounded-full bg-black/30 hover:bg-black/50 text-white border border-white/20 backdrop-blur-md disabled:opacity-30"
          >
            ↑
          </Button>
          <Button
            onClick={goToNext}
            disabled={currentIndex >= articles.length - 1}
            size="sm"
            className="rounded-full bg-black/30 hover:bg-black/50 text-white border border-white/20 backdrop-blur-md disabled:opacity-30"
          >
            ↓
          </Button>
        </div>
      </div>

      {/* Indicador de scroll */}
      {currentIndex < articles.length - 1 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 animate-bounce">
          <div className="bg-black/30 backdrop-blur-md rounded-full p-3 border border-white/20">
            <ArrowDown className="h-5 w-5 text-white" />
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="fixed bottom-6 left-6 z-40">
          <div className="bg-black/30 backdrop-blur-md rounded-full p-3 border border-white/20 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-white" />
            <span className="text-white text-sm">Carregando mais...</span>
          </div>
        </div>
      )}

      {/* Modal de artigos salvos */}
      <Dialog open={showSaved} onOpenChange={setShowSaved}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
              <Bookmark className="h-6 w-6" />
              Artigos Salvos ({userPreferences.savedArticles.length})
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[60vh] space-y-4">
            {getSavedArticles().length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum artigo salvo ainda</p>
                <p className="text-sm">Salve artigos interessantes para ler depois!</p>
              </div>
            ) : (
              getSavedArticles().map((article: Article) => (
                <Card key={article.id} className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <h3 className="font-bold text-white mb-2">{article.title}</h3>
                    <p className="text-gray-300 text-sm mb-3 line-clamp-3">{article.abstract}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-gray-400 text-sm">
                        <span>{article.year}</span>
                        {article.authors.length > 0 && (
                          <span>
                            {article.authors[0].name}
                            {article.authors.length > 1 && " et al."}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleShare(article)}
                          className="text-gray-400 hover:text-white"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSave(article)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        {article.url && article.url !== "#" && (
                          <Button size="sm" asChild className="bg-blue-600 hover:bg-blue-700">
                            <a href={article.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
