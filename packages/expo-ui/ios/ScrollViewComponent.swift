// Copyright 2026-present 650 Industries. All rights reserved.

import SwiftUI
import Combine
import ExpoModulesCore

/// Side-channel from native imperative methods into the SwiftUI tree.
/// `scrolledID` is bound to `.scrollPosition(id:)` so writes from
/// `scrollToId` drive SwiftUI's native scroll position, and SwiftUI writes
/// back the leading id when the user scrolls.
final class ScrollViewActions: ObservableObject {
  @Published var scrolledID: String?
  fileprivate var didSeedInitial = false
}

public final class ScrollViewComponentProps: UIBaseViewProps {
  @Field var axes: AxisOptions = .vertical
  @Field var showsIndicators: Bool = true
  /// Initial scroll target id. Read once at first construction; later
  /// changes are ignored. Use the `scrollToId` AsyncFunction to navigate
  /// after mount. iOS 17+ — backed by SwiftUI's `.scrollPosition(id:)`.
  @Field var initialScrollId: String?
  @Field var onScrollGeometryChangeSync: WorkletCallback?
  var onScrollPhaseChange = EventDispatcher()
  var onScrollGeometryChange = EventDispatcher()
  var onScrolledIDChange = EventDispatcher()
  let actions = ScrollViewActions()
}

public struct ScrollViewComponent: ExpoSwiftUI.View {
  @ObservedObject public var props: ScrollViewComponentProps
  @ObservedObject private var actions: ScrollViewActions

  public init(props: ScrollViewComponentProps) {
    self.props = props
    self.actions = props.actions
    // Seed once before the first body() call so SwiftUI's first layout
    // pass reads the initial scrolledID — no mount flicker.
    if !props.actions.didSeedInitial {
      props.actions.didSeedInitial = true
      props.actions.scrolledID = props.initialScrollId
    }
  }

  /// Imperatively scroll to a child carrying `.id(id)`. When `animated` is
  /// true, the position change is wrapped in `withAnimation`. Requires
  /// iOS 17+ — depends on SwiftUI's `.scrollPosition(id:)` modifier.
  public func scrollToId(id: String, animated: Bool) {
    let actions = props.actions
    DispatchQueue.main.async {
      if animated {
        withAnimation {
          actions.scrolledID = id
        }
      } else {
        actions.scrolledID = id
      }
    }
  }

  public var body: some View {
    Group {
      if #available(iOS 18.0, tvOS 18.0, *) {
        modernScrollView
      } else if #available(iOS 17.0, tvOS 17.0, *) {
        midScrollView
      } else {
        legacyScrollView
      }
    }
  }

  /// iOS < 17: no `.scrollPosition` or scroll-target callbacks. The view
  /// still renders, but `initialScrollId` and `scrollToId` are no-ops.
  private var legacyScrollView: some View {
    ScrollView(props.axes.toAxis(), showsIndicators: props.showsIndicators) {
      Children()
    }
  }

  @available(iOS 17.0, tvOS 17.0, *)
  private var midScrollView: some View {
    ScrollView(props.axes.toAxis(), showsIndicators: props.showsIndicators) {
      Children()
    }
    .scrollPosition(id: $actions.scrolledID)
    .onReceive(actions.$scrolledID.dropFirst()) { id in
      // Fires for both directions: imperative writes from `scrollToId`
      // and writebacks SwiftUI performs when the leading visible id
      // changes (e.g., after the user swipes and pages snap).
      // `dropFirst()` skips the seed emission.
      props.onScrolledIDChange(["id": id as Any])
    }
  }

  @available(iOS 18.0, tvOS 18.0, *)
  private var modernScrollView: some View {
    ScrollView(props.axes.toAxis(), showsIndicators: props.showsIndicators) {
      Children()
    }
    .scrollPosition(id: $actions.scrolledID)
    .onReceive(actions.$scrolledID.dropFirst()) { id in
      props.onScrolledIDChange(["id": id as Any])
    }
    .onScrollPhaseChange { _, newPhase, context in
      // Geometry is bundled into the phase event so consumers can read
      // scroll state at phase boundaries without subscribing to per-frame
      // onScrollGeometryChange.
      let g = context.geometry
      props.onScrollPhaseChange([
        "phase": Self.phaseString(newPhase),
        "geometry": [
          "contentOffsetX": g.contentOffset.x,
          "contentOffsetY": g.contentOffset.y,
          "containerWidth": g.containerSize.width,
          "containerHeight": g.containerSize.height,
          "contentWidth": g.contentSize.width,
          "contentHeight": g.contentSize.height
        ] as [String: Any]
      ])
    }
    .onScrollGeometryChange(for: ScrollGeometryPayload.self) { geometry in
      ScrollGeometryPayload(
        contentOffsetX: geometry.contentOffset.x,
        contentOffsetY: geometry.contentOffset.y,
        containerWidth: geometry.containerSize.width,
        containerHeight: geometry.containerSize.height,
        contentWidth: geometry.contentSize.width,
        contentHeight: geometry.contentSize.height
      )
    } action: { _, payload in
      let geometry: [String: Any] = [
        "contentOffsetX": payload.contentOffsetX,
        "contentOffsetY": payload.contentOffsetY,
        "containerWidth": payload.containerWidth,
        "containerHeight": payload.containerHeight,
        "contentWidth": payload.contentWidth,
        "contentHeight": payload.contentHeight
      ]
      // Mutually exclusive: the JS wrapper only wires one path at a time.
      // Skipping the regular dispatcher when a worklet is attached avoids
      // the per-frame dictionary allocation + async JS-thread event dispatch.
      if let sync = props.onScrollGeometryChangeSync {
        sync.invoke(arguments: [geometry])
      } else {
        props.onScrollGeometryChange(geometry)
      }
    }
  }

  @available(iOS 18.0, tvOS 18.0, *)
  private static func phaseString(_ phase: ScrollPhase) -> String {
    switch phase {
    case .idle: return "idle"
    case .tracking: return "tracking"
    case .interacting: return "interacting"
    case .animating: return "animating"
    case .decelerating: return "decelerating"
    @unknown default: return "idle"
    }
  }
}

// Equatable transform of `ScrollGeometry` so `.onScrollGeometryChange` only
// fires when an observed dimension actually changes.
private struct ScrollGeometryPayload: Equatable {
  let contentOffsetX: CGFloat
  let contentOffsetY: CGFloat
  let containerWidth: CGFloat
  let containerHeight: CGFloat
  let contentWidth: CGFloat
  let contentHeight: CGFloat
}
