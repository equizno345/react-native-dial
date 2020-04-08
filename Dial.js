// Base imports
import React from "react";
import PropTypes from "prop-types";

// UI Components
import {
  Dimensions,
  PanResponder,
  StyleSheet,
  View,
  ViewPropTypes
} from "react-native";

// Other
import { throttle } from "lodash";


const GREY_LIGHT = "#EEEEEE";


export class Dial extends React.Component {
  static propTypes = {
    elastic: PropTypes.bool,
    fixed: PropTypes.bool,
    incrementBy: PropTypes.number,
    initialAngle: PropTypes.number,
    initialRadius: PropTypes.number,
    onAngleXChange: PropTypes.func,
    onPress: PropTypes.func,
    onValueChange: PropTypes.func,
    pointerEvents: PropTypes.oneOf(["box-none", "none", "box-only", "auto"]),
    precision: PropTypes.number,
    radiusMax: PropTypes.number,
    radiusMin: PropTypes.number,
    responderStyle: ViewPropTypes.style,
    wrapperStyle: ViewPropTypes.style
  };

  static defaultProps = {
    initialRadius: 1,
    initialAngle: 0,
    precision: 0
  };

  constructor(props) {
    super(props);
  
    this.state = {
      startingAngle: this.props.initialAngle,
      startingRadius: this.props.initialRadius,
      releaseAngle: this.props.initialAngle,
      releaseRadius: this.props.initialRadius,
      angle: this.props.initialAngle,
      radius: this.props.initialRadius,
      angleX: this.props.initialAngle
    };
  
    this.offset = { x: 0, y: 0 };
    this.updateState = throttle(this.updateState.bind(this), 16, { trailing: false });
  }

  updateState({ deg, degX, radius = this.state.radius }) {
    radius = this.state.releaseRadius + radius - this.state.startingRadius;
    if (radius < this.props.radiusMin) radius = this.props.radiusMin;
    else if (radius > this.props.radiusMax) radius = this.props.radiusMax;

    let angle = deg + this.state.releaseAngle - this.state.startingAngle;
    if (angle > 360) angle = angle % 360
    if (angle < 0) angle+= 360
    if (deg < 0) deg += 360;

    if (angle !== this.state.angle || radius !== this.state.radius) {
      this.setState({ angle, radius });
      this.props.onValueChange && this.props.onValueChange(angle, radius);
    }
 
    this.setState({ angleX: degX });
    this.props.onAngleXChange && this.props.onAngleXChange(degX);
  }

  onLayout = () => {
    /*
    * Multiple measures to avoid the gap between animated
    * and not animated views
    */
    this.measureOffset();
    setTimeout(() => this.measureOffset(), 200);
  };

  measureOffset = () => {
    /*
    * const {x, y, width, height} = nativeEvent.layout
    * onlayout values are different than measureInWindow
    * x and y are the distances to its previous element
    * but in measureInWindow they are relative to the window
    */
    const { width: screenWidth } = Dimensions.get("window");

    this.self.measureInWindow((x, y, width, height) => {
      this.offset = {
        x: x % screenWidth + width / 2,
        y: y + height / 2,
      };
      this.radius = width / 2;
    });
  };

  updateAngle = gestureState => {
    let { deg, radius } = this.calcAngle(gestureState);
    const degX = deg;
    if (deg < 0) deg += 360;
    if (Math.abs(this.state.angle - deg) > this.props.precision) {
      this.updateState({ deg, degX, radius });
    }
  };

  calcAngle = gestureState => {
    const { pageX, pageY, moveX, moveY } = gestureState;
    const [x, y] = [pageX || moveX, pageY || moveY];
    const [dx, dy] = [x - this.offset.x, y - this.offset.y];
    return {
      deg: Math.atan2(dy, dx) * 180 / Math.PI + 120,
      radius: Math.sqrt(dy * dy + dx * dx) / this.radius, // pitagoras r^2 = x^2 + y^2 normalizado
    };
  };

  forceUpdate = (deg, radius) => {
    this.setState({
      angle: deg === undefined ? this.state.angle : deg,
      radius: radius === undefined ? this.state.radius : radius,
    });
  };

  resetState = () => {
    this.setState({
      startingAngle: this.props.initialAngle,
      startingRadius: this.props.initialRadius,
      releaseAngle: this.props.initialAngle,
      releaseRadius: this.props.initialRadius,
      angle: this.props.initialAngle,
      radius: this.props.initialRadius,
      angleX: this.props.initialAngle
    });
  };

  // Lifecycle methods
  componentWillMount() {
    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: e => {
        this.measureOffset(); // measure again
        const { deg, radius } = this.calcAngle(e.nativeEvent);
        this.setState({ startingAngle: deg, startingRadius: radius });
        return true;
      },
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => true,
      onPanResponderMove: (_, gestureState) => {
        this.updateAngle(gestureState);
      },
      onPanResponderRelease: () => {
        const {
          angle,
          radius,
          releaseAngle,
          releaseRadius,
        } = this.state;

        if (angle !== releaseAngle || radius !== releaseRadius) {
          this.setState({
            releaseAngle: angle,
            releaseRadius: radius,
          });
        }
      },
    });
  }

  render() {
    const rotate = this.props.fixed ? "0deg" : `${this.state.angle}deg`;
    const scale = this.props.elastic ? this.state.radius : 1;

    /**
     * `pointerEvents` are now ignored.
     * Should be handled based on the component's internal structure and be added (if there are any)
     * to the corresponding view(s).
     */
    const pevProp = this.props.pointerEvents != null ? { pointerEvents: this.props.pointerEvents } : {};

    return (
      <View
        onLayout={(nativeEvent) => this.onLayout(nativeEvent)}
        ref={(node) => { this.self = node; }}
        style={[styles.coverResponder, this.props.responderStyle]}
        {...pevProp}
        {...this._panResponder.panHandlers}
      >
        {this.props.children
          ? <View {...pevProp} style={[this.props.wrapperStyle, { transform: [{ rotate }, { scale }] }]}>
            {this.props.children}
          </View>
          : <DefaultDial style={this.props.style} rotate={rotate} scale={scale} />
        }
      </View>
    );
  }
}

export const DefaultDial = ({ style = {}, rotate = "0rad", scale = 1 }) => (
  <View
    style={[styles.dial, style, {
      transform: [
        { rotate }, { scale },
      ]
    }]} >
    <View style={styles.innerDialDecorator}>
      <View style={styles.pointer} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  coverResponder: {
    padding: 20, // needs a minimum
  },
  dial: {
    width: 120,
    height: 120,
    backgroundColor: "white",
    borderRadius: 60,
    elevation: 5,
    shadowColor: GREY_LIGHT,
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 1,
  },
  innerDialDecorator: {
    top: 10,
    left: 10,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "white",
    elevation: 3,
  },
  pointer: {
    top: 20,
    left: 20,
    position: "absolute",
    width: 10,
    height: 10,
    backgroundColor: "rgb(221,223,226)",
    borderRadius: 5,
  },
});
