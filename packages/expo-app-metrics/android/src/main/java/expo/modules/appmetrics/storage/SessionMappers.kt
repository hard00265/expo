package expo.modules.appmetrics.storage

import expo.modules.appmetrics.utils.TimeUtils
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.UUID
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

/**
 * JS-facing shape of a session. Field names mirror the TypeScript `Session`
 * type (`startDate` / `endDate`), distinct from the Room column names
 * (`startTimestamp` / `endTimestamp`).
 *
 * `type` is hard-coded to `"main"` since the per-launch session opened in
 * `AppMetricsModule.OnCreate` is the only one we track. A future change
 * should add a real `type` column and lifecycle hooks for
 * foreground/screen/custom sessions.
 */
data class JsSession(
  @Field val id: String,
  @Field val type: String,
  @Field val startDate: String,
  @Field val endDate: String?,
  @Field val metrics: List<JsMetric>,
  // Android doesn't collect log events yet; emitted as an empty list so
  // consumers can rely on the same shape iOS produces.
  @Field val logs: List<Any> = emptyList()
) : Record {
  companion object {
    fun fromSessionWithMetrics(value: SessionWithMetrics): JsSession =
      JsSession(
        id = value.session.id,
        type = "main",
        startDate = value.session.startTimestamp,
        endDate = value.session.endTimestamp,
        metrics = value.metrics.map { JsMetric.fromMetric(it) }
      )
  }
}

data class JsMetric(
  @Field val sessionId: String,
  @Field val category: String,
  @Field val name: String,
  @Field val value: Double,
  @Field val metricId: String? = UUID.randomUUID().toString(),
  @Field val timestamp: String = TimeUtils.getCurrentTimestampInISOFormat(),
  @Field val routeName: String? = null,
  @Field val updateId: String? = null,
  @Field val params: Map<String, Any?>? = null
) : Record {
  fun toMetric(): Metric =
    Metric(
      metricId = metricId ?: UUID.randomUUID().toString(),
      sessionId = sessionId,
      timestamp = timestamp,
      category = category,
      name = name,
      value = value,
      routeName = routeName,
      updateId = updateId,
      params = params?.let { encodeAnyMapToJsonString(it) }
    )

  companion object {
    fun fromMetric(metric: Metric): JsMetric =
      JsMetric(
        metricId = metric.metricId,
        sessionId = metric.sessionId,
        timestamp = metric.timestamp,
        category = metric.category,
        name = metric.name,
        value = metric.value,
        routeName = metric.routeName,
        updateId = metric.updateId,
        params = decodeJsonObject(metric.params)
      )
  }
}

/**
 * Decodes a JSON-encoded object string into a `Map<String, Any?>` whose values
 * are plain Kotlin primitives (`String`, `Long`, `Double`, `Boolean`, `List`,
 * `Map`, or `null`). Returns `null` if the input is `null`/empty or if parsing
 * fails — JS code treats `null` as "no extras".
 */
private fun decodeJsonObject(jsonString: String?): Map<String, Any?>? {
  if (jsonString.isNullOrEmpty()) {
    return null
  }
  return runCatching {
    val element = Json.decodeFromString<JsonElement>(jsonString)
    if (element !is JsonObject) {
      return@runCatching null
    }
    element.mapValues { (_, v) -> jsonElementToAny(v) }
  }.getOrNull()
}

private fun jsonElementToAny(element: JsonElement): Any? {
  return when (element) {
    is JsonNull -> null
    is JsonPrimitive -> when {
      element.isString -> element.content
      else -> element.booleanOrNull
        ?: element.longOrNull
        ?: element.doubleOrNull
        ?: element.content
    }
    is JsonObject -> element.mapValues { (_, v) -> jsonElementToAny(v) }
    is JsonArray -> element.map { jsonElementToAny(it) }
  }
}

/**
 * Encodes a `Map<String, Any?>` from JS into a JSON string. Required because
 * `Json.encodeToString(map)` fails at runtime with "Serializer for class 'Any'
 * is not found" — kotlinx.serialization has no built-in serializer for `Any`,
 * so we walk the structure ourselves and wrap each leaf in a `JsonPrimitive`.
 */
internal fun encodeAnyMapToJsonString(map: Map<String, Any?>): String =
  Json.encodeToString(JsonObject.serializer(), anyMapToJsonObject(map))

private fun anyMapToJsonObject(map: Map<String, Any?>): JsonObject =
  buildJsonObject {
    map.forEach { (key, value) -> put(key, anyToJsonElement(value)) }
  }

private fun anyToJsonElement(value: Any?): JsonElement = when (value) {
  null -> JsonNull
  is Boolean -> JsonPrimitive(value)
  is Number -> JsonPrimitive(value)
  is String -> JsonPrimitive(value)
  is Map<*, *> -> buildJsonObject {
    value.forEach { (k, v) -> put(k.toString(), anyToJsonElement(v)) }
  }
  is Iterable<*> -> buildJsonArray { value.forEach { add(anyToJsonElement(it)) } }
  is Array<*> -> buildJsonArray { value.forEach { add(anyToJsonElement(it)) } }
  else -> JsonPrimitive(value.toString())
}
