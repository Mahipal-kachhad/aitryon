import { useGLTF } from "@react-three/drei";
import { JSX, useEffect } from "react";

const Glasses = (props: JSX.IntrinsicElements["mesh"]) => {
    const { scene } = useGLTF("/models/glases.glb");

    return (
        <primitive object={scene} {...props} />
    );
};

export default Glasses;