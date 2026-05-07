package expo.modules.appmetrics.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [28])
class SessionMappersTest {
  private fun makeSession(
    id: String = "session-1",
    startTimestamp: String = "2025-01-01T00:00:00.000Z",
    endTimestamp: String? = null
  ): Session = Session(
    id = id,
    startTimestamp = startTimestamp,
    endTimestamp = endTimestamp,
    isActive = endTimestamp == null
  )

  private fun makeMetric(
    metricId: String = "metric-1",
    sessionId: String = "session-1",
    params: String? = null
  ): Metric = Metric(
    metricId = metricId,
    sessionId = sessionId,
    timestamp = "2025-01-01T00:00:01.000Z",
    category = "appStartup",
    name = "timeToInteractive",
    value = 1.5,
    params = params
  )

  @Test
  fun `JsSession_fromSessionWithMetrics exposes the JS-facing field names`() {
    val swm = SessionWithMetrics(
      session = makeSession(id = "abc", startTimestamp = "2025-06-15T10:00:00.000Z"),
      metrics = emptyList()
    )

    val js = JsSession.fromSessionWithMetrics(swm)

    assertEquals("abc", js.id)
    assertEquals("main", js.type)
    assertEquals("2025-06-15T10:00:00.000Z", js.startDate)
    assertNull(js.endDate)
    assertEquals(emptyList<JsMetric>(), js.metrics)
  }

  @Test
  fun `JsSession_fromSessionWithMetrics surfaces endDate when set`() {
    val swm = SessionWithMetrics(
      session = makeSession(endTimestamp = "2025-01-02T00:00:00.000Z"),
      metrics = emptyList()
    )

    val js = JsSession.fromSessionWithMetrics(swm)

    assertEquals("2025-01-02T00:00:00.000Z", js.endDate)
  }

  @Test
  fun `JsMetric_fromMetric decodes params from JSON`() {
    val metric = makeMetric(params = """{"screen":"Home","attempt":3,"flag":true}""")

    val js = JsMetric.fromMetric(metric)

    val params = js.params
    assertEquals("Home", params?.get("screen"))
    assertEquals(3L, params?.get("attempt"))
    assertEquals(true, params?.get("flag"))
  }

  @Test
  fun `JsMetric_fromMetric yields null params when storage column is null`() {
    val js = JsMetric.fromMetric(makeMetric(params = null))

    assertNull(js.params)
  }

  @Test
  fun `JsMetric_fromMetric yields null params when storage column is malformed JSON`() {
    val js = JsMetric.fromMetric(makeMetric(params = "{ this is not valid json"))

    assertNull(js.params)
  }

  @Test
  fun `JsMetric_fromMetric copies scalar fields verbatim`() {
    val js = JsMetric.fromMetric(makeMetric(metricId = "m-42", sessionId = "session-1"))

    assertEquals("m-42", js.metricId)
    assertEquals("session-1", js.sessionId)
    assertEquals("appStartup", js.category)
    assertEquals("timeToInteractive", js.name)
    assertEquals(1.5, js.value, 0.0)
    assertEquals("2025-01-01T00:00:01.000Z", js.timestamp)
  }

  @Test
  fun `encodeAnyMapToJsonString round-trips primitives, booleans and nested structures`() {
    val encoded = encodeAnyMapToJsonString(
      mapOf(
        "isInitial" to true,
        "isAppLaunch" to false,
        "screen" to "Home",
        "attempt" to 3,
        "ratio" to 1.5,
        "missing" to null,
        "tags" to listOf("a", "b"),
        "nested" to mapOf("k" to true)
      )
    )

    val decoded = JsMetric.fromMetric(makeMetric(params = encoded)).params!!
    assertEquals(true, decoded["isInitial"])
    assertEquals(false, decoded["isAppLaunch"])
    assertEquals("Home", decoded["screen"])
    assertEquals(3L, decoded["attempt"])
    assertEquals(1.5, decoded["ratio"])
    assertNull(decoded["missing"])
    assertEquals(listOf("a", "b"), decoded["tags"])
    assertEquals(mapOf("k" to true), decoded["nested"])
  }
}
