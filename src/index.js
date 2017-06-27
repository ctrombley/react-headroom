import React, { Component } from 'react' // eslint-disable-line import/no-unresolved
import PropTypes from 'prop-types'
import shallowequal from 'shallowequal'
import raf from 'raf'
import shouldUpdate from './shouldUpdate'

const noop = () => {}

export default class Headroom extends Component {
  static propTypes = {
    alwaysPinned: PropTypes.bool,
    children: PropTypes.any.isRequired,
    disable: PropTypes.bool,
    disableInlineStyles: PropTypes.bool,
    downTolerance: PropTypes.number,
    footer: PropTypes.bool,
    onPin: PropTypes.func,
    onUnfix: PropTypes.func,
    onUnpin: PropTypes.func,
    parent: PropTypes.func,
    pinStart: PropTypes.number,
    style: PropTypes.object,
    upTolerance: PropTypes.number,
    wrapperStyle: PropTypes.object,
  };

  static defaultProps = {
    alwaysPinned: false,
    disable: false,
    disableInlineStyles: false,
    downTolerance: 0,
    footer: false,
    onPin: noop,
    onUnfix: noop,
    onUnpin: noop,
    parent: () => window,
    pinStart: 0,
    upTolerance: 5,
    wrapperStyle: {},
  };

  constructor (props) {
    super(props)
    // Class variables.
    this.currentScrollY = 0
    this.lastKnownScrollY = 0
    this.ticking = false

    const initialState = this.props.footer ? 'pinned' : 'unfixed'
    this.state = {
      state: initialState,
      translateY: 0,
      className: `headroom headroom--${initialState}`,
    }
  }

  componentDidMount () {
    this.setHeightOffset()
    if (!this.props.disable) {
      this.props.parent().addEventListener('scroll', this.handleScroll)
    }
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.disable && !this.props.disable) {
      this.unfix()
      this.props.parent().removeEventListener('scroll', this.handleScroll)
    } else if (!nextProps.disable && this.props.disable) {
      this.props.parent().addEventListener('scroll', this.handleScroll)
    }
  }

  shouldComponentUpdate (nextProps, nextState) {
    return (
      !shallowequal(this.props, nextProps) ||
      !shallowequal(this.state, nextState)
    )
  }

  componentDidUpdate (prevProps) {
    // If children have changed, remeasure height.
    if (prevProps.children !== this.props.children) {
      this.setHeightOffset()
    }
  }

  componentWillUnmount () {
    this.props.parent().removeEventListener('scroll', this.handleScroll)
    window.removeEventListener('scroll', this.handleScroll)
  }

  setHeightOffset = () => {
    this.setState({
      height: this.refs.inner.offsetHeight,
    })
  }

  getScrollY = () => {
    if (this.props.parent().pageYOffset !== undefined) {
      return this.props.parent().pageYOffset
    } else if (this.props.parent().scrollTop !== undefined) {
      return this.props.parent().scrollTop
    } else {
      return (document.documentElement || document.body.parentNode || document.body).scrollTop
    }
  }

  getViewportHeight = () => (
    window.innerHeight
      || document.documentElement.clientHeight
      || document.body.clientHeight
  )

  getDocumentHeight = () => {
    const body = document.body
    const documentElement = document.documentElement

    return Math.max(
      body.scrollHeight, documentElement.scrollHeight,
      body.offsetHeight, documentElement.offsetHeight,
      body.clientHeight, documentElement.clientHeight
    )
  }

  getElementPhysicalHeight = elm => Math.max(
    elm.offsetHeight,
    elm.clientHeight
  )

  getElementHeight = elm => Math.max(
    elm.scrollHeight,
    elm.offsetHeight,
    elm.clientHeight,
  )

  getScrollerPhysicalHeight = () => {
    const parent = this.props.parent()

    return (parent === window || parent === document.body)
      ? this.getViewportHeight()
      : this.getElementPhysicalHeight(parent)
  }

  getScrollerHeight = () => {
    const parent = this.props.parent()

    return (parent === window || parent === document.body)
      ? this.getDocumentHeight()
      : this.getElementHeight(parent)
  }

  isOutOfBound = (currentScrollY) => {
    const pastTop = currentScrollY < 0

    const scrollerPhysicalHeight = this.getScrollerPhysicalHeight()
    const scrollerHeight = this.getScrollerHeight()

    const pastBottom = currentScrollY + scrollerPhysicalHeight > scrollerHeight

    return pastTop || pastBottom
  }

  handleScroll = () => {
    if (!this.ticking) {
      this.ticking = true
      raf(this.update)
    }
  }

  unpin = () => {
    this.props.onUnpin()

    const translateY = this.props.footer ? `${this.state.height}px` : '-100%'

    this.setState({
      translateY,
      className: 'headroom headroom--unpinned',
    }, () => {
      setTimeout(() => {
        this.setState({ state: 'unpinned' })
      }, 0)
    })
  }

  pin = () => {
    this.props.onPin()

    this.setState({
      translateY: 0,
      className: 'headroom headroom--pinned',
      state: 'pinned',
    })
  }

  unfix = () => {
    this.props.onUnfix()

    this.setState({
      translateY: 0,
      className: 'headroom headroom--unfixed',
      state: 'unfixed',
    })
  }

  update = () => {
    this.currentScrollY = this.getScrollY()

    if (!this.isOutOfBound(this.currentScrollY)) {
      const { action } = shouldUpdate(
        this.lastKnownScrollY,
        this.currentScrollY,
        this.props,
        this.state
      )

      if (action === 'pin') {
        this.pin()
      } else if (action === 'unpin') {
        this.unpin()
      } else if (action === 'unfix') {
        this.unfix()
      }
    }

    this.lastKnownScrollY = this.currentScrollY
    this.ticking = false
  }

  render () {
    const { ...divProps } = this.props
    const footer = divProps.footer

    delete divProps.alwaysPinned
    delete divProps.children
    delete divProps.disable
    delete divProps.disableInlineStyles
    delete divProps.downTolerance
    delete divProps.footer
    delete divProps.onPin
    delete divProps.onUnfix
    delete divProps.onUnpin
    delete divProps.parent
    delete divProps.pinStart
    delete divProps.upTolerance

    const { style, wrapperStyle, ...rest } = divProps

    let innerStyle = {
      position: this.props.disable || this.state.state === 'unfixed' ? 'relative' : 'fixed',
      left: 0,
      right: 0,
      zIndex: 1,
      WebkitTransform: `translateY(${this.state.translateY})`,
      MsTransform: `translateY(${this.state.translateY})`,
      transform: `translateY(${this.state.translateY})`,
    }

    if (footer) {
      innerStyle.bottom = 0
    } else {
      innerStyle.top = 0
    }

    let className = this.state.className

    // Don't add css transitions until after we've done the initial
    // negative transform when transitioning from 'unfixed' to 'unpinned'.
    // If we don't do this, the header will flash into view temporarily
    // while it transitions from 0 — -100%.
    if (this.state.state !== 'unfixed') {
      innerStyle = {
        ...innerStyle,
        WebkitTransition: 'all .2s ease-in-out',
        MozTransition: 'all .2s ease-in-out',
        OTransition: 'all .2s ease-in-out',
        transition: 'all .2s ease-in-out',
      }
      className += ' headroom--scrolled'
    }

    if (!this.props.disableInlineStyles) {
      innerStyle = {
        ...innerStyle,
        ...style,
      }
    } else {
      innerStyle = style
    }

    const wrapperStyles = {
      ...wrapperStyle,
      height: this.state.height ? this.state.height : null,
    }

    return (
      <div style={wrapperStyles} className="headroom-wrapper">
        <div
          ref="inner"
          {...rest}
          style={innerStyle}
          className={className}
        >
          {this.props.children}
        </div>
      </div>
    )
  }
}
