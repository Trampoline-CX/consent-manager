import {
  WindowWithAJS,
  Destination,
  DefaultDestinationBehavior,
  CategoryPreferences,
  Middleware
} from '../types'

interface AnalyticsParams {
  writeKey: string
  destinations: Destination[]
  destinationPreferences: CategoryPreferences | null | undefined
  isConsentRequired: boolean
  shouldReload?: boolean
  defaultDestinationBehavior?: DefaultDestinationBehavior
  categoryPreferences: CategoryPreferences | null | undefined
}

function getConsentMiddleware(
  destinationPreferences,
  categoryPreferences,
  defaultDestinationBehavior
): Middleware {
  return ({ payload, next }) => {
    payload.obj.context.consent = {
      defaultDestinationBehavior,
      categoryPreferences,
      destinationPreferences
    }
    next(payload)
  }
}

export default function conditionallyLoadAnalytics({
  writeKey,
  destinations,
  destinationPreferences,
  isConsentRequired,
  shouldReload = true,
  defaultDestinationBehavior,
  categoryPreferences
}: AnalyticsParams) {
  const wd = window as WindowWithAJS
  const integrations = { All: false, 'Segment.io': true }
  let isAnythingEnabled = false

  if (!destinationPreferences) {
    if (isConsentRequired) {
      return
    }

    // Load a.js normally when consent isn't required and there's no preferences
    if (!wd.analytics.initialized) {
      wd.analytics.load(writeKey)
    }
    return
  }

  for (const destination of destinations) {
    // Was a preference explicitly set on this destination?
    const explicitPreference = destination.id in destinationPreferences
    if (!explicitPreference && defaultDestinationBehavior === 'enable') {
      integrations[destination.id] = true
      continue
    }

    const isEnabled = Boolean(destinationPreferences[destination.id])
    if (isEnabled) {
      isAnythingEnabled = true
    }
    integrations[destination.id] = isEnabled
  }

  // Reload the page if the trackers have already been initialised so that
  // the user's new preferences can take affect
  if (wd.analytics && wd.analytics.initialized) {
    if (shouldReload) {
      console.warn(
        "Segment library was already initialized. The default library would have reloaded but the Trampoline version doesn't."
      )
      // window.location.reload()
    }
    return
  }

  // Don't load a.js at all if nothing has been enabled
  if (isAnythingEnabled) {
    const middleware = getConsentMiddleware(
      destinationPreferences,
      categoryPreferences,
      defaultDestinationBehavior
    )
    // @ts-ignore: Analytics.JS type should be updated with addSourceMiddleware
    wd.analytics.addSourceMiddleware(middleware)

    wd.analytics.load(writeKey, { integrations })
  }
}
